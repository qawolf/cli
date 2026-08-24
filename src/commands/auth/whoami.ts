import { errorMessage } from "~/core/errors.js";
import { authMessages } from "~/core/messages/index.js";
import { exitCodes } from "~/shell/exit.js";
import { requireApiKey } from "~/domains/auth/index.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";

type WhoamiDeps = {
  requireApiKey?: typeof requireApiKey;
  createPlatform?: typeof createPlatformClient;
};

export async function handleWhoami(
  ctx: CommandContext,
  deps: WhoamiDeps = {},
): Promise<CommandResult> {
  ctx.ui.gap();
  ctx.ui.intro(authMessages.title);

  let resolved: Awaited<ReturnType<typeof requireApiKey>> | undefined;
  try {
    resolved = await (deps.requireApiKey ?? requireApiKey)(
      ctx.configDir,
      ctx.fs,
    );
  } catch (err: unknown) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(errorMessage(err), authMessages.whoamiFailed);
    } else {
      ctx.ui.output(
        { authenticated: false, source: undefined },
        authMessages.notAuthenticated,
      );
    }
    return { error: "not authenticated", exitCode: exitCodes.auth };
  }

  const platformClient = (deps.createPlatform ?? createPlatformClient)(
    resolved.key,
    {
      baseUrl: ctx.apiBaseUrl,
      fetch: globalThis.fetch,
      logger: ctx.log("trpc"),
    },
  );

  const identity = await platformClient.getIdentity();

  if (!identity.ok) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(
        authMessages.whoami.source(resolved.source),
        authMessages.whoamiFailed,
      );
      ctx.ui.warn(identity.error);
    } else {
      ctx.ui.output(
        {
          authenticated: false,
          error: identity.error,
          source: resolved.source,
          valid: false,
        },
        authMessages.whoami.authFailed(resolved.source, identity.error),
      );
    }
    return {
      error: "invalid key",
      ...(identity.exitCode === undefined
        ? {}
        : { exitCode: identity.exitCode }),
    };
  }

  const { value } = identity;

  if ("user" in value) {
    const { organization, user } = value;
    if (ctx.ui.mode === "human") {
      ctx.ui.note(
        authMessages.whoami.userNote({
          organization,
          source: resolved.source,
          user,
        }),
        authMessages.whoamiAuthenticated,
      );
      ctx.ui.outro(authMessages.outroReady);
    } else {
      ctx.ui.output(
        {
          authenticated: true,
          organization,
          source: resolved.source,
          user,
        },
        authMessages.whoami.authenticatedAs(user.email, resolved.source),
      );
    }
    return;
  }

  if ("organization" in value) {
    const { organization } = value;
    if (ctx.ui.mode === "human") {
      ctx.ui.note(
        authMessages.whoami.organizationNote({
          organization,
          source: resolved.source,
        }),
        authMessages.whoamiAuthenticated,
      );
      ctx.ui.outro(authMessages.outroReady);
    } else {
      ctx.ui.output(
        {
          authenticated: true,
          organization,
          source: resolved.source,
        },
        authMessages.whoami.authenticatedAs(organization.name, resolved.source),
      );
    }
    return;
  }

  const { team } = value;
  const teamUrl = team.slug
    ? new URL("/" + encodeURIComponent(team.slug), ctx.apiBaseUrl).toString()
    : undefined;

  if (ctx.ui.mode === "human") {
    ctx.ui.note(
      authMessages.whoami.teamNote({ team, teamUrl, source: resolved.source }),
      authMessages.whoamiAuthenticated,
    );
    ctx.ui.outro(authMessages.outroReady);
  } else {
    ctx.ui.output(
      {
        authenticated: true,
        source: resolved.source,
        team,
        teamUrl,
      },
      authMessages.whoami.authenticatedAs(team.name, resolved.source),
    );
  }
}
