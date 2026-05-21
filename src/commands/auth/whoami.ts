import {
  type AuthCommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { authCopy } from "~/core/copy/index.js";

export async function handleWhoami(
  ctx: AuthCommandContext,
): Promise<CommandResult> {
  ctx.ui.gap();
  ctx.ui.intro(authCopy.title);

  const identity = await ctx.platform.getIdentity();

  if (!identity.ok) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(`Source: ${ctx.apiKeySource}`, authCopy.whoamiFailed);
      ctx.ui.warn(identity.error);
    } else {
      ctx.ui.output(
        {
          authenticated: false,
          error: identity.error,
          source: ctx.apiKeySource,
          valid: false,
        },
        `Authentication failed (source: ${ctx.apiKeySource}): ${identity.error}`,
      );
    }
    return { error: "invalid key" };
  }

  const { team } = identity.value;
  if (ctx.ui.mode === "human") {
    ctx.ui.note(
      [
        `Team:   ${team.name}`,
        `ID:     ${team.id}`,
        `Source: ${ctx.apiKeySource}`,
      ].join("\n"),
      authCopy.whoamiAuthenticated,
    );
    ctx.ui.outro(authCopy.outroReady);
  } else {
    ctx.ui.output(
      {
        authenticated: true,
        source: ctx.apiKeySource,
        team,
      },
      `Authenticated as ${team.name} (source: ${ctx.apiKeySource})`,
    );
  }
}
