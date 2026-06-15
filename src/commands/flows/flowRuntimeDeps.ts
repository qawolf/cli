import { resolveApiKey } from "~/domains/auth/resolve.js";
import { configureEmails } from "~/domains/emails/configureEmails.js";
import type { FlowRuntimeDeps } from "~/domains/runner/flowRuntimeDeps.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import { makeEnvVarDeps } from "./envVarDeps.js";

type CreateFlowRuntimeDepsArgs = {
  readonly envDir: string;
  readonly ctx: Pick<CommandContext, "apiBaseUrl" | "configDir" | "fs"> &
    Partial<Pick<CommandContext, "log">>;
  readonly platform?: PlatformClient;
  readonly env?: Record<string, string | undefined>;
  readonly resolveApiKeyFn?: typeof resolveApiKey;
  readonly configureEmailsFn?: typeof configureEmails;
  readonly createPlatform?: typeof createPlatformClient;
};

type GetInbox = NonNullable<FlowRuntimeDeps["getInbox"]>;

type LazyGetInboxArgs = Omit<
  Required<CreateFlowRuntimeDepsArgs>,
  "platform"
> & {
  readonly platform: PlatformClient | undefined;
};

async function maybeGetIdentityTeamId(
  platform: PlatformClient,
): Promise<string | undefined> {
  const identity = await platform.getIdentity();
  return identity.ok ? identity.value.team.id : undefined;
}

function lazyGetInbox({
  envDir,
  ctx,
  platform,
  env,
  resolveApiKeyFn,
  configureEmailsFn,
  createPlatform,
}: LazyGetInboxArgs): GetInbox {
  let getInboxPromise: Promise<GetInbox> | undefined;

  async function configure(): Promise<GetInbox> {
    const explicitEmailerUrl = env["EMAILER_URL"];
    let teamId = env["CLOUD_AGENTS_INBOX_TEAM_ID"];
    const apiKeyResult =
      explicitEmailerUrl === undefined
        ? await resolveApiKeyFn(ctx.configDir, ctx.fs)
        : undefined;

    if (teamId === undefined && platform !== undefined) {
      teamId = await maybeGetIdentityTeamId(platform);
    }

    if (teamId === undefined && apiKeyResult !== undefined) {
      const identityPlatform = createPlatform(apiKeyResult.key, {
        baseUrl: ctx.apiBaseUrl,
        fetch: globalThis.fetch,
        ...(ctx.log ? { logger: ctx.log("trpc") } : {}),
      });
      teamId = await maybeGetIdentityTeamId(identityPlatform);
    }

    const teamIdPart = teamId !== undefined ? { teamId } : {};
    if (explicitEmailerUrl !== undefined) {
      const client = await configureEmailsFn(
        { emailerUrl: explicitEmailerUrl, ...teamIdPart },
        envDir,
      );
      return client.getInbox;
    }

    if (apiKeyResult === undefined) {
      throw new Error(
        "getInbox requires EMAILER_URL, QAWOLF_API_KEY, or stored QA Wolf credentials. Run 'qawolf auth login'.",
      );
    }

    const client = await configureEmailsFn(
      { apiKey: apiKeyResult.key, url: `${ctx.apiBaseUrl}/api`, ...teamIdPart },
      envDir,
    );
    return client.getInbox;
  }

  return async (...args) => {
    getInboxPromise ??= configure();
    const getInbox = await getInboxPromise;
    return getInbox(...args);
  };
}

export function createFlowRuntimeDeps({
  envDir,
  ctx,
  platform,
  env = process.env,
  resolveApiKeyFn = resolveApiKey,
  configureEmailsFn = configureEmails,
  createPlatform = createPlatformClient,
}: CreateFlowRuntimeDepsArgs): FlowRuntimeDeps {
  return {
    ...makeEnvVarDeps(envDir, ctx.fs),
    getInbox: lazyGetInbox({
      envDir,
      ctx,
      platform,
      env,
      resolveApiKeyFn,
      configureEmailsFn,
      createPlatform,
    }),
  };
}
