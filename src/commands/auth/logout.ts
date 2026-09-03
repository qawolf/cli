import {
  deleteApiKey as realDeleteApiKey,
  resolveApiKey as realResolveApiKey,
} from "~/domains/auth/index.js";
import { deleteTokens as realDeleteTokens } from "~/domains/auth/store/deleteTokens.js";
import type { ApiKeyResult } from "~/domains/auth/types.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { authMessages } from "~/core/messages/index.js";

type LogoutDeps = {
  resolveApiKey?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<ApiKeyResult | undefined>;
  deleteApiKey?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<unknown>;
  deleteTokens?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<unknown>;
};

export async function handleLogout(
  ctx: CommandContext,
  deps: LogoutDeps = {},
): Promise<CommandResult> {
  const resolveApiKey = deps.resolveApiKey ?? realResolveApiKey;
  const deleteApiKey = deps.deleteApiKey ?? realDeleteApiKey;
  const deleteTokens = deps.deleteTokens ?? realDeleteTokens;

  const resolved = await resolveApiKey(ctx.configDir, ctx.fs);

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
        // Both credential kinds go, whichever one resolved. Clearing only the
        // one in use would leave the other to take over on the next command,
        // so "logged out" would not be true.
        task: async () => {
          await Promise.all([
            deleteApiKey(ctx.configDir, ctx.fs),
            deleteTokens(ctx.configDir, ctx.fs),
          ]);
        },
      },
    ],
    () => authMessages.logout.credentialsRemoved,
  );

  if (ctx.ui.mode === "human") {
    ctx.ui.outro(authMessages.logout.success);
  } else {
    ctx.ui.output({ loggedOut: true }, authMessages.logout.success);
  }
}
