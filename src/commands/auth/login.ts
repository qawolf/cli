import {
  resolveApiKey,
  saveApiKey,
  validateApiKey,
} from "~/domains/auth/index.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { authMessages } from "~/core/messages/index.js";

export async function handleLogin(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.ui.mode !== "human") {
    ctx.ui.error(authMessages.login.nonInteractive);
    return { error: "non-interactive" };
  }

  const existing = await resolveApiKey(ctx.configDir);
  if (existing) {
    const reauth = await ctx.ui.confirm(authMessages.login.reAuthPrompt);
    if (!reauth.ok || !reauth.value) {
      ctx.ui.info(authMessages.alreadyConfigured);
      return;
    }
  }

  ctx.ui.gap();
  ctx.ui.intro(authMessages.title);

  const result = await ctx.ui.password(
    authMessages.promptApiKey,
    "Set QAWOLF_API_KEY to authenticate in non-interactive environments.",
  );
  if (!result.ok) {
    ctx.ui.cancel(authMessages.cancelled);
    return;
  }

  if (!result.value.trim()) {
    ctx.ui.cancel(authMessages.cancelled);
    return;
  }

  await ctx.ui.withProgress(
    [
      {
        message: authMessages.verifying,
        task: async () => {
          const v = await validateApiKey({
            platform: createPlatformClient(result.value, {
              baseUrl: ctx.apiBaseUrl,
              fetch: globalThis.fetch,
            }),
          });
          if (!v.valid) throw Error(v.error);
        },
      },
      {
        message: authMessages.storing,
        task: async () => saveApiKey(ctx.configDir, result.value),
      },
    ],
    ([, saveResult]) => {
      return saveResult.stored === "file"
        ? authMessages.storedFile
        : authMessages.storedKeychain;
    },
  );

  ctx.ui.outro(authMessages.outroSuccess);
}
