import { requireApiKey, validateApiKey } from "~/domains/auth/index.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { authCopy } from "~/core/copy/index.js";

export async function handleWhoami(
  ctx: CommandContext,
): Promise<CommandResult> {
  const resolved = await requireApiKey(ctx.configDir);

  ctx.ui.gap();
  ctx.ui.intro(authCopy.title);

  const validation = await validateApiKey(resolved.key, {
    platform: createPlatformClient(resolved.key, {
      baseUrl: ctx.apiBaseUrl,
      fetch: globalThis.fetch,
    }),
  });

  if (!validation.valid) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(`Source: ${resolved.source}`, authCopy.whoamiFailed);
      ctx.ui.warn(validation.error);
    } else {
      ctx.ui.output(
        {
          authenticated: false,
          error: validation.error,
          source: resolved.source,
          valid: false,
        },
        `Authentication failed (source: ${resolved.source}): ${validation.error}`,
      );
    }
    return { error: "invalid key" };
  }

  if (ctx.ui.mode === "human") {
    ctx.ui.note(
      [
        `Team:   ${validation.team.name}`,
        `ID:     ${validation.team.id}`,
        `Source: ${resolved.source}`,
      ].join("\n"),
      authCopy.whoamiAuthenticated,
    );
    ctx.ui.outro(authCopy.outroReady);
  } else {
    ctx.ui.output(
      {
        authenticated: true,
        source: resolved.source,
        team: validation.team,
      },
      `Authenticated as ${validation.team.name} (source: ${resolved.source})`,
    );
  }
}
