import { resolveApiKey, saveApiKey, validateApiKey } from "~/lib/auth/index.js";
import { type CommandContext, type CommandResult } from "~/lib/context.js";
import { authCopy } from "~/lib/copy/index.js";
import { errorMessage } from "~/lib/errors.js";

export async function handleLogin(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.ui.mode !== "human") {
    ctx.ui.error(authCopy.login.nonInteractive);
    return { error: "non-interactive" };
  }

  const existing = await resolveApiKey(ctx.configDir);
  if (existing) {
    const reauth = await ctx.ui.confirm(authCopy.login.reAuthPrompt);
    if (!reauth.ok || !reauth.value) {
      ctx.ui.info(authCopy.alreadyConfigured);
      return;
    }
  }

  ctx.ui.gap();
  ctx.ui.intro(authCopy.title);

  const result = await ctx.ui.password(
    authCopy.promptApiKey,
    "Set QAWOLF_API_KEY to authenticate in non-interactive environments.",
  );
  if (!result.ok) {
    ctx.ui.cancel(authCopy.cancelled);
    return;
  }

  try {
    await ctx.ui.withProgress(
      [
        {
          message: authCopy.verifying,
          task: async () => {
            const v = await validateApiKey(result.value);
            if (!v.valid) throw Error(authCopy.validationFailed);
          },
        },
        {
          message: authCopy.storing,
          task: async () => saveApiKey(ctx.configDir, result.value),
        },
      ],
      ([, saveResult]) => {
        return saveResult.stored === "file"
          ? authCopy.storedFile
          : authCopy.storedKeychain;
      },
    );
  } catch (err: unknown) {
    ctx.ui.error(errorMessage(err));
    return { error: errorMessage(err) };
  }

  ctx.ui.outro(authCopy.outroSuccess);
}
