import { authMessages } from "~/core/messages/index.js";
import type { CommandContext } from "~/shell/commandContext.js";
import type { TeamIdentity } from "~/shell/platform/getIdentity.js";

/**
 * Reports the identity an API key resolves to.
 *
 * "Workspace" is the name this object carries everywhere a person can see it;
 * `team` is the platform's internal name for the same thing, kept in the JSON
 * output because scripts already read that key.
 *
 * The workspace page URL is built here because only this identity has a slug to
 * build one from.
 */
export function reportTeamIdentity(
  ctx: CommandContext,
  value: { team: TeamIdentity },
  source: string,
): void {
  const { team } = value;
  const teamUrl = team.slug
    ? new URL("/" + encodeURIComponent(team.slug), ctx.apiBaseUrl).toString()
    : undefined;

  if (ctx.ui.mode === "human") {
    ctx.ui.note(
      authMessages.whoami.teamNote({ team, teamUrl, source }),
      authMessages.whoamiAuthenticated,
    );
    ctx.ui.outro(authMessages.outroReady);
  } else {
    ctx.ui.output(
      {
        authenticated: true,
        source,
        team,
        teamUrl,
      },
      authMessages.whoami.authenticatedAs(team.name, source),
    );
  }
}
