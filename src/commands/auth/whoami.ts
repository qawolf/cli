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

  const { team } = ctx;
  const teamUrl = new URL(
    "/" + encodeURIComponent(team.slug),
    ctx.apiBaseUrl,
  ).toString();

  if (ctx.ui.mode === "human") {
    ctx.ui.note(
      [
        `Team:   ${team.name}`,
        `ID:     ${team.id}`,
        `Slug:   ${team.slug}`,
        `URL:    ${teamUrl}`,
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
        teamUrl,
      },
      `Authenticated as ${team.name} (source: ${ctx.apiKeySource})`,
    );
  }
}
