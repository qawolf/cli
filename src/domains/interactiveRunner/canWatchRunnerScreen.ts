import type { AuthCommandContext } from "~/shell/commandContext.js";

/**
 * Whether the runner page will play a screen for this caller. A runner's screen
 * plays only for the QA Wolf user that launched it, so a browser sign-in is
 * always that user, while an API key may be a team key, whose runners belong to
 * the team's automation user and refuse every person.
 */
export function canWatchRunnerScreen(ctx: AuthCommandContext): boolean {
  return ctx.apiKeySource === "browser";
}
