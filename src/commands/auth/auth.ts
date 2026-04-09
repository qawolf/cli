import { resolveApiKey } from "../../lib/auth/index.js";
import { type CommandContext, type CommandResult } from "../../lib/context.js";
import { authCopy } from "../../lib/copy/index.js";
import { handleLogin } from "./login.js";

export async function handleAuth(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.ui.mode !== "human") {
    const resolved = await resolveApiKey(ctx.configDir);
    if (!resolved) {
      ctx.ui.error(authCopy.ci.errorTitle, authCopy.ci.errorBody);
      return { error: "not authenticated" };
    }
    return;
  }

  return handleLogin(ctx);
}
