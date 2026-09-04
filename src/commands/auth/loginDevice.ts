import { authMessages } from "~/core/messages/index.js";
import { sleep } from "~/core/sleep.js";
import {
  type ConnectConfig,
  resolveConnectConfig,
} from "~/domains/auth/connectConfig.js";
import { deviceLogin } from "~/domains/auth/deviceLogin.js";
import { fetchSessionEmail } from "~/domains/auth/sessionEmail.js";
import { saveTokens } from "~/domains/auth/store/saveTokens.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { pollDeviceToken } from "~/shell/workos/pollDeviceToken.js";
import { refreshAccessToken } from "~/shell/workos/refreshAccessToken.js";
import { requestDeviceAuthorization } from "~/shell/workos/requestDeviceAuthorization.js";
import { defaultOpenBrowser, showDeviceCode } from "./showDeviceCode.js";
import { chooseWorkspace, reportWorkspace } from "./chooseWorkspace.js";

export type LoginDeviceDeps = {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  fetch?: typeof globalThis.fetch;
  openBrowser?: (url: string) => Promise<boolean>;
};

function describeConfigFailure(
  ctx: CommandContext,
  result: Exclude<
    Awaited<ReturnType<typeof resolveConnectConfig>>,
    { kind: "configured" }
  >,
): CommandResult {
  const m = authMessages.device;
  switch (result.kind) {
    case "unreachable":
      ctx.log("auth").debug(`auth config unreachable: ${result.detail}`);
      return { error: m.configUnreachable, errorBody: result.detail };
    case "unavailable":
      return { error: m.unavailable };
    case "legacy-only":
      return { error: m.legacyOnly };
    case "misconfigured":
      return { error: m.misconfigured, errorBody: result.detail };
    case "discovery-failed":
      return { error: m.discoveryFailed, errorBody: result.detail };
  }
}

async function signIn(
  ctx: CommandContext,
  config: ConnectConfig,
  deps: Required<LoginDeviceDeps>,
): Promise<CommandResult> {
  const workos = {
    fetch: deps.fetch,
    clientId: config.clientId,
    resource: config.resource,
    endpoints: config.endpoints,
  };

  // Ctrl-C runs the signal registry, which flips this flag so the polling loop
  // stops at its next check instead of being killed mid-request.
  let cancelled = false;
  const unregister = ctx.signals.register(() => {
    cancelled = true;
  });

  try {
    const result = await deviceLogin({
      requestAuthorization: () => requestDeviceAuthorization(workos),
      pollToken: (deviceCode) => pollDeviceToken(deviceCode, workos),
      refreshTokens: (refreshToken) => refreshAccessToken(refreshToken, workos),
      binding: { issuer: config.issuer, resource: config.resource },
      fetchEmail: (accessToken) =>
        fetchSessionEmail(accessToken, {
          fetch: deps.fetch,
          baseUrl: ctx.apiBaseUrl,
        }),
      onPrompt: (authorization) =>
        showDeviceCode(ctx, authorization, {
          platform: deps.platform,
          openBrowser: deps.openBrowser,
        }),
      sleep,
      now: () => Date.now(),
      isCancelled: () => cancelled,
    });

    if (!result.ok) {
      // Returned rather than printed: withContext renders a CommandResult, so
      // printing here too showed the copy followed by the bare reason code.
      return {
        error: authMessages.device.failed[result.reason],
        ...(result.detail ? { errorBody: result.detail } : {}),
      };
    }

    // Only the resource-bound pair the API has accepted is worth keeping. The
    // binding rides with it so a later refresh asks the deployment nothing.
    const session = {
      ...result.session,
      workspaceId: undefined,
      issuer: config.issuer,
      clientId: config.clientId,
      resource: config.resource,
    };
    await saveTokens(ctx.configDir, session, ctx.fs);

    // WorkOS puts the session in an organization of its choosing, so settle
    // which workspace to work in before declaring success.
    const workspace = await chooseWorkspace(ctx, {
      session,
      env: deps.env,
      fetch: deps.fetch,
    });
    // Honoured rather than discarded, as its sibling handleSwitchWorkspace
    // does. The credential is saved either way, but a session with no workspace
    // fails every public API command, so reporting plain success would send the
    // person away believing they are ready.
    const failure = reportWorkspace(ctx, workspace);
    if (failure) return failure;

    ctx.ui.outro(authMessages.device.signedIn(result.session.email));
    return;
  } finally {
    unregister();
  }
}

/** Browser sign-in. Assumes the caller has already shown the intro. */
export async function loginWithDevice(
  ctx: CommandContext,
  deps: LoginDeviceDeps = {},
): Promise<CommandResult> {
  const platform = deps.platform ?? process.platform;
  const resolved: Required<LoginDeviceDeps> = {
    env: deps.env ?? process.env,
    platform,
    fetch: deps.fetch ?? globalThis.fetch,
    openBrowser: deps.openBrowser ?? defaultOpenBrowser(platform),
  };

  // The deployment publishes the issuer and client id it signs people in
  // with, so the CLI carries none and follows whatever host it is aimed at.
  const config = await resolveConnectConfig({
    apiBaseUrl: ctx.apiBaseUrl,
    fetch: resolved.fetch,
  });
  if (config.kind !== "configured") return describeConfigFailure(ctx, config);

  return signIn(ctx, config.config, resolved);
}
