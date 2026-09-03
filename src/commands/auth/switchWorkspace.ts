import { Entry } from "@napi-rs/keyring";

import { authMessages } from "~/core/messages/index.js";
import { loadTokens } from "~/domains/auth/store/loadTokens.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { chooseWorkspace, reportWorkspace } from "./chooseWorkspace.js";

export type SwitchWorkspaceDeps = {
  env?: Record<string, string | undefined>;
};

/**
 * Moves a browser session into another workspace without repeating the browser
 * flow: the stored refresh token is redeemed against the chosen workspace's
 * organization.
 */
export async function handleSwitchWorkspace(
  ctx: CommandContext,
  deps: SwitchWorkspaceDeps = {},
): Promise<CommandResult> {
  const env = deps.env ?? process.env;
  const preferred =
    env["QAWOLF_WORKSPACE"]?.trim() ?? env["QAWOLF_ORGANIZATION"]?.trim();

  if (ctx.ui.mode !== "human" && !preferred) {
    ctx.ui.error(authMessages.workspace.nonInteractive);
    return { error: "non-interactive" };
  }

  const stored = await loadTokens(ctx.configDir, {
    EntryClass: Entry,
    fs: ctx.fs,
  });
  if (!stored.found) {
    ctx.ui.error(authMessages.workspace.notSignedIn);
    return { error: "not signed in" };
  }

  ctx.ui.gap();
  ctx.ui.intro(authMessages.title);

  const result = await chooseWorkspace(ctx, {
    session: stored.tokens,
    env,
    fetch: globalThis.fetch,
  });

  const failure = reportWorkspace(ctx, result);
  if (failure) return failure;

  ctx.ui.outro(authMessages.outroReady);
  return;
}
