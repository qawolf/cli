import { resolveApiKey } from "../../lib/auth/index.js";
import { type CommandContext, type CommandResult } from "../../lib/context.js";
import { authCopy } from "../../lib/copy/index.js";

export async function handleWhoami(
  ctx: CommandContext,
): Promise<CommandResult> {
  const resolved = await resolveApiKey(ctx.configDir);

  if (!resolved) {
    ctx.ui.error(authCopy.ci.errorTitle, authCopy.ci.errorBody);
    return { error: "not authenticated" };
  }

  if (ctx.ui.mode === "human") {
    ctx.ui.gap();
    ctx.ui.intro(authCopy.title);
    ctx.ui.note(`Source: ${resolved.source}`, authCopy.whoamiAuthenticated);
    ctx.ui.outro(authCopy.outroReady);
  } else {
    ctx.ui.output(
      { authenticated: true, source: resolved.source },
      `Authenticated (source: ${resolved.source})`,
    );
  }
}
