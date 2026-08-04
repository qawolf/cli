import { resolveApiKey } from "~/domains/auth/resolve.js";
import {
  configureEmails,
  registerLazyEmailsClient,
} from "~/domains/emails/configureEmails.js";
import type { FlowRuntimeDeps } from "~/domains/runner/flowRuntimeDeps.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import { makeEnvVarDeps } from "./envVarDeps.js";

type CreateFlowRuntimeDepsArgs = {
  readonly envDir: string;
  readonly ctx: Pick<CommandContext, "apiBaseUrl" | "configDir" | "fs"> &
    Partial<Pick<CommandContext, "log">>;
  readonly env?: Record<string, string | undefined>;
  readonly resolveApiKeyFn?: typeof resolveApiKey;
  readonly configureEmailsFn?: typeof configureEmails;
  readonly createPlatform?: typeof createPlatformClient;
};

type GetInbox = NonNullable<FlowRuntimeDeps["getInbox"]>;

type LazyGetInboxArgs = Required<CreateFlowRuntimeDepsArgs>;

async function maybeGetIdentityTeamId(
  platformClient: PlatformClient,
): Promise<string | undefined> {
  const identity = await platformClient.getIdentity();
  if (!identity.ok || !("team" in identity.value)) return undefined;
  return identity.value.team.id;
}

function lazyGetInbox({
  envDir,
  ctx,
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

    if (teamId === undefined && apiKeyResult !== undefined) {
      const identityClient = createPlatform(apiKeyResult.key, {
        baseUrl: ctx.apiBaseUrl,
        fetch: globalThis.fetch,
        ...(ctx.log ? { logger: ctx.log("trpc") } : {}),
      });
      teamId = await maybeGetIdentityTeamId(identityClient);
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

export async function createFlowRuntimeDeps({
  envDir,
  ctx,
  env = process.env,
  resolveApiKeyFn = resolveApiKey,
  configureEmailsFn = configureEmails,
  createPlatform = createPlatformClient,
}: CreateFlowRuntimeDepsArgs): Promise<FlowRuntimeDeps> {
  const getInbox = lazyGetInbox({
    envDir,
    ctx,
    env,
    resolveApiKeyFn,
    configureEmailsFn,
    createPlatform,
  });
  // Eagerly register a lazy client as the module-global so mail.inbox()-only
  // flows route through the same lazy getInbox. Graceful: if @qawolf/emails
  // can't be loaded, mail.inbox() flows surface their own clear error at use.
  try {
    await registerLazyEmailsClient(getInbox, envDir);
  } catch {
    // @qawolf/emails not resolvable in the env dir; leave the global unset.
  }
  return {
    ...makeEnvVarDeps(envDir, ctx.fs),
    getInbox,
  };
}
