import type { DeviceAuthorization } from "~/core/deviceAuth/types.js";
import { authMessages } from "~/core/messages/index.js";
import { sleep } from "~/core/sleep.js";
import { deviceLogin } from "~/domains/auth/deviceLogin.js";
import { saveTokens } from "~/domains/auth/store/saveTokens.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { openBrowser } from "~/shell/openBrowser.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { getAuthConfig } from "~/shell/platform/getAuthConfig.js";
import { resolveWorkosConfig } from "~/shell/workos/config.js";
import { pollDeviceToken } from "~/shell/workos/pollDeviceToken.js";
import { requestDeviceAuthorization } from "~/shell/workos/requestDeviceAuthorization.js";

export type LoginDeviceDeps = {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
};

/** Browser sign-in. Assumes the caller has already shown the intro. */
export async function loginWithDevice(
  ctx: CommandContext,
  deps: LoginDeviceDeps = {},
): Promise<CommandResult> {
  // The deployment publishes the client id it signs people in with, so the
  // CLI carries none and follows whatever host it is aimed at.
  const config = resolveWorkosConfig(
    await getAuthConfig({ baseUrl: ctx.apiBaseUrl, fetch: globalThis.fetch }),
  );
  if (!config.configured) {
    ctx.ui.error(authMessages.device.unavailable);
    return { error: "browser sign-in unavailable" };
  }

  const workos = {
    fetch: globalThis.fetch,
    baseUrl: config.baseUrl,
    clientId: config.clientId,
  };

  // Ctrl-C runs the signal registry, which flips this flag so the polling loop
  // stops at its next check instead of being killed mid-request.
  let cancelled = false;
  const unregister = ctx.signals.register(() => {
    cancelled = true;
  });

  const showCode = async (authorization: DeviceAuthorization) => {
    const url =
      authorization.verificationUriComplete ?? authorization.verificationUri;
    ctx.ui.note(
      [
        authMessages.device.confirmCode(authorization.userCode),
        authMessages.device.visitUrl(url),
        url === authorization.verificationUri
          ? undefined
          : authMessages.device.visitUrlPlain(authorization.verificationUri),
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
      authMessages.title,
    );

    const opened = await openBrowser(url, {
      spawn: defaultSpawn,
      platform: deps.platform ?? process.platform,
    });
    if (!opened) ctx.ui.info(authMessages.device.openFailed(url));

    ctx.ui.step(authMessages.device.waiting);
  };

  try {
    const result = await deviceLogin({
      requestAuthorization: () => requestDeviceAuthorization(workos),
      pollToken: (deviceCode) => pollDeviceToken(deviceCode, workos),
      onPrompt: showCode,
      sleep,
      now: () => Date.now(),
      isCancelled: () => cancelled,
    });

    if (!result.ok) {
      const message = authMessages.device.failed[result.reason];
      ctx.ui.error(message, result.detail);
      return { error: result.reason };
    }

    await saveTokens(
      ctx.configDir,
      { ...result.tokens, clientId: config.clientId },
      ctx.fs,
    );

    ctx.ui.outro(authMessages.device.signedIn(result.tokens.email));
    return;
  } finally {
    unregister();
  }
}
