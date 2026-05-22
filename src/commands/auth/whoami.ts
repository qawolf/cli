import { errorMessage } from "~/core/errors.js";
import { authMessages } from "~/core/messages/index.js";
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
    resolved = await (deps.requireApiKey ?? requireApiKey)(ctx.configDir);
  } catch (err: unknown) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(errorMessage(err), authMessages.whoamiFailed);
    } else {
      ctx.ui.output(
        { authenticated: false, source: undefined },
        "Not authenticated",
      );
    }
    return { error: "not authenticated" };
  }

  const platform = (deps.createPlatform ?? createPlatformClient)(resolved.key, {
    baseUrl: ctx.apiBaseUrl,
    fetch: globalThis.fetch,
    logger: ctx.log("trpc"),
  });

  const identity = await platform.getIdentity();

  if (!identity.ok) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(`Source: ${resolved.source}`, authMessages.whoamiFailed);
      ctx.ui.warn(identity.error);
    } else {
      ctx.ui.output(
        {
          authenticated: false,
          error: identity.error,
          source: resolved.source,
          valid: false,
        },
        `Authentication failed (source: ${resolved.source}): ${identity.error}`,
      );
    }
    return { error: "invalid key" };
  }

  const { team } = identity.value;
  const teamUrl = team.slug
    ? new URL("/" + encodeURIComponent(team.slug), ctx.apiBaseUrl).toString()
    : undefined;

  if (ctx.ui.mode === "human") {
    ctx.ui.note(
      [
        `Team:   ${team.name}`,
        `ID:     ${team.id}`,
        team.slug && `Slug:   ${team.slug}`,
        teamUrl && `URL:    ${teamUrl}`,
        `Source: ${resolved.source}`,
      ]
        .filter(Boolean)
        .join("\n"),
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
      `Authenticated as ${team.name} (source: ${resolved.source})`,
    );
  }
}
