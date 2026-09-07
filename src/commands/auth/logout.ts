import { deleteApiKey as realDeleteApiKey } from "~/domains/auth/index.js";
import { deleteTokens as realDeleteTokens } from "~/domains/auth/store/deleteTokens.js";
import { hasStoredCredentials as realHasStoredCredentials } from "~/domains/auth/store/index.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { authMessages } from "~/core/messages/index.js";

type LogoutDeps = {
  hasStoredCredentials?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<boolean>;
  deleteApiKey?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<unknown>;
  deleteTokens?: (
    configDir: string,
    fs: CommandContext["fs"],
  ) => Promise<unknown>;
  env?: Record<string, string | undefined>;
};

export async function handleLogout(
  ctx: CommandContext,
  deps: LogoutDeps = {},
): Promise<CommandResult> {
  const hasStoredCredentials =
    deps.hasStoredCredentials ?? realHasStoredCredentials;
  const deleteApiKey = deps.deleteApiKey ?? realDeleteApiKey;
  const deleteTokens = deps.deleteTokens ?? realDeleteTokens;
  const env = deps.env ?? process.env;

  // Storage is asked directly rather than through resolveApiKey. Resolving a
  // browser session refreshes it over the network, so being offline or holding
  // a refresh token WorkOS has already rotated away would report "not
  // authenticated" and leave the credentials in place — the one case where
  // clearing them matters most.
  const envKey = env["QAWOLF_API_KEY"]?.trim();
  const stored = await hasStoredCredentials(ctx.configDir, ctx.fs);

  if (!envKey && !stored) {
    ctx.ui.info(authMessages.logout.notAuthenticated);
    return;
  }

  if (envKey) {
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
        // Both credential kinds go, whichever one is present. Clearing only the
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
