import { errorMessage } from "~/core/errors.js";
import { authMessages } from "~/core/messages/index.js";
import { exitCodes } from "~/shell/exit.js";
import { requireApiKey } from "~/domains/auth/index.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { reportTeamIdentity } from "./whoamiTeam.js";

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

    // The chosen workspace is what every public API command sends, so the one
    // command whose job is to report the session has to name it. A stored id
    // the account can no longer reach is worth showing too — nothing else
    // surfaces it, and every later request would fail on it.
    const found = value.organizations
      .flatMap((candidate) =>
        candidate.workspaces.map((workspace) => ({
          organization: candidate.name,
          workspace: workspace.name,
          id: workspace.id,
        })),
      )
      .find((entry) => entry.id === resolved.workspaceId);
    const activeWorkspace = resolved.workspaceId
      ? authMessages.whoami.activeWorkspace(resolved.workspaceId, found)
      : undefined;
    if (ctx.ui.mode === "human") {
      ctx.ui.note(
        authMessages.whoami.userNote({
          organization,
          source: resolved.source,
          user,
          activeWorkspace,
          organizations: value.organizations,
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
          workspaceId: resolved.workspaceId,
          organizations: value.organizations,
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

  reportTeamIdentity(ctx, value, resolved.source);
}
