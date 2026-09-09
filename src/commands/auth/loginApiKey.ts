import { saveApiKey, validateApiKey } from "~/domains/auth/index.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { authMessages } from "~/core/messages/index.js";

/** Paste-a-key sign-in. Assumes the caller has already shown the intro. */
export async function loginWithApiKey(
  ctx: CommandContext,
): Promise<CommandResult> {
  const result = await ctx.ui.password(
    authMessages.promptApiKey,
    "Set QAWOLF_API_KEY to authenticate in non-interactive environments.",
  );
  if (!result.ok) {
    ctx.ui.cancel(authMessages.cancelled);
    return;
  }

  // Normalised once: a pasted key routinely carries whitespace, and validating
  // one string while storing another would persist a key that cannot work.
  const apiKey = result.value.trim();
  if (!apiKey) {
    ctx.ui.cancel(authMessages.cancelled);
    return;
  }

  await ctx.ui.withProgress(
    [
      {
        message: authMessages.verifying,
        task: async () => {
          const v = await validateApiKey({
            platformClient: createPlatformClient(apiKey, {
              baseUrl: ctx.apiBaseUrl,
              fetch: globalThis.fetch,
            }),
          });
          if (!v.valid) throw Error(v.error);
        },
      },
      {
        message: authMessages.storing,
        task: async () => saveApiKey(ctx.configDir, apiKey, ctx.fs),
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
