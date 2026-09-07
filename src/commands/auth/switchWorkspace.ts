import { authMessages } from "~/core/messages/index.js";
import { refreshStoredSession as realRefreshStoredSession } from "~/domains/auth/refreshStoredSession.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { chooseWorkspace, reportWorkspace } from "./chooseWorkspace.js";

export type SwitchWorkspaceDeps = {
  env?: Record<string, string | undefined>;
  refreshStoredSession?: typeof realRefreshStoredSession;
};

/**
 * Moves a browser session into another workspace without repeating the browser
 * flow. The choice is local: routes take the workspace as an argument, so the
 * credential itself does not change — but it is renewed first, because a spent
 * access token would report the session as an invalid credential instead of
 * switching.
 */
export async function handleSwitchWorkspace(
  ctx: CommandContext,
  deps: SwitchWorkspaceDeps = {},
): Promise<CommandResult> {
  const env = deps.env ?? process.env;
  const refreshStoredSession =
    deps.refreshStoredSession ?? realRefreshStoredSession;
  // `||`, not `??`: a variable exported as empty trims to "", which is not
  // nullish, and would otherwise mask the other one entirely.
  const preferred =
    env["QAWOLF_WORKSPACE"]?.trim() || env["QAWOLF_ORGANIZATION"]?.trim();

  if (ctx.ui.mode !== "human" && !preferred) {
    ctx.ui.error(authMessages.workspace.nonInteractive);
    return { error: "non-interactive" };
  }

  const stored = await refreshStoredSession(ctx.configDir, ctx.fs);

  if (stored.kind === "not-signed-in") {
    ctx.ui.error(authMessages.workspace.notSignedIn);
    return { error: "not signed in" };
  }

  if (stored.kind === "refresh-failed") {
    ctx.ui.error(authMessages.workspace.sessionExpired);
    return { error: "session expired" };
  }

  ctx.ui.gap();
  ctx.ui.intro(authMessages.title);

  const result = await chooseWorkspace(ctx, {
    session: stored.session,
    env,
    fetch: globalThis.fetch,
  });

  const failure = reportWorkspace(ctx, result);
  if (failure) return failure;

  ctx.ui.outro(authMessages.outroReady);
  return;
}
