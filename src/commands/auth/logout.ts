import { deleteApiKey, resolveApiKey } from "~/lib/auth/index.js";
import { type CommandContext, type CommandResult } from "~/lib/context.js";
import { authCopy } from "~/lib/copy/index.js";

export async function handleLogout(
  ctx: CommandContext,
): Promise<CommandResult> {
  const resolved = await resolveApiKey(ctx.configDir);

  if (!resolved) {
    ctx.ui.info(authCopy.logout.notAuthenticated);
    return;
  }

  if (resolved.source === "env") {
    ctx.ui.warn(authCopy.logout.envVarWarning);
  }

  if (ctx.ui.mode === "human") {
    ctx.ui.gap();
    ctx.ui.intro(authCopy.logout.title);

    const result = await ctx.ui.confirm(authCopy.logout.confirmPrompt);
    if (!result.ok || !result.value) {
      ctx.ui.cancel(authCopy.logout.cancelled);
      return;
    }
  }

  await ctx.ui.withProgress(
    [
      {
        message: authCopy.logout.deleting,
        task: () => deleteApiKey(ctx.configDir),
      },
    ],
    () => "Credentials removed",
  );

  if (ctx.ui.mode === "human") {
    ctx.ui.outro(authCopy.logout.success);
  } else {
    ctx.ui.output({ loggedOut: true }, authCopy.logout.success);
  }
}
