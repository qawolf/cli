import {
  type AuthCommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { authMessages } from "~/core/messages/index.js";

export async function handleWhoami(
  ctx: AuthCommandContext,
): Promise<CommandResult> {
  ctx.ui.gap();
  ctx.ui.intro(authMessages.title);

  const identity = await ctx.platform.getIdentity();

  if (!identity.ok) {
    if (ctx.ui.mode === "human") {
      ctx.ui.note(`Source: ${ctx.apiKeySource}`, authMessages.whoamiFailed);
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
      authMessages.whoamiAuthenticated,
    );
    ctx.ui.outro(authMessages.outroReady);
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
