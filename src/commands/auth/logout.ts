import { deleteApiKey, resolveApiKey } from "~/domains/auth/index.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { authMessages } from "~/core/messages/index.js";

export async function handleLogout(
  ctx: CommandContext,
): Promise<CommandResult> {
  const resolved = await resolveApiKey(ctx.configDir);

  if (!resolved) {
    ctx.ui.info(authMessages.logout.notAuthenticated);
    return;
  }

  if (resolved.source === "env") {
    ctx.ui.warn(authMessages.logout.envVarWarning);
  }

  if (ctx.ui.mode === "human") {
    ctx.ui.gap();
    ctx.ui.intro(authMessages.logout.title);

    const result = await ctx.ui.confirm(authMessages.logout.confirmPrompt);
    if (!result.ok || !result.value) {
      ctx.ui.cancel(authMessages.logout.cancelled);
      return;
    }
  }

  await ctx.ui.withProgress(
    [
      {
        message: authMessages.logout.deleting,
        task: () => deleteApiKey(ctx.configDir),
      },
    ],
    () => "Credentials removed",
  );

  if (ctx.ui.mode === "human") {
    ctx.ui.outro(authMessages.logout.success);
  } else {
    ctx.ui.output({ loggedOut: true }, authMessages.logout.success);
  }
}
