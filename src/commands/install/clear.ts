import { installMessages } from "~/core/messages/index.js";
import {
  clearRuntimeEnv,
  managedEnvBaseDir,
} from "~/domains/runtimeEnv/index.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";

export type HandleInstallClearOpts = { readonly yes: boolean };

export async function handleInstallClear(
  ctx: CommandContext,
  opts: HandleInstallClearOpts,
): Promise<CommandResult> {
  const dir = managedEnvBaseDir();

  if (ctx.ui.mode === "human" && !opts.yes) {
    ctx.ui.gap();
    ctx.ui.intro(installMessages.clear.title);
    ctx.ui.note(dir, installMessages.clear.locationLabel);

    const result = await ctx.ui.confirm(installMessages.clear.confirmPrompt, {
      destructive: true,
    });
    if (!result.ok || !result.value) {
      ctx.ui.cancel(installMessages.clear.cancelled);
      return;
    }
  }

  const [{ existed }] = await ctx.ui.withProgress(
    [
      {
        message: installMessages.clear.removing,
        task: () => clearRuntimeEnv(ctx.fs),
      },
    ],
    ([result]) =>
      result.existed
        ? installMessages.clear.cleared
        : installMessages.clear.nothingToClear,
  );

  if (ctx.ui.mode !== "human") {
    ctx.ui.output(
      { cleared: existed, dir },
      existed
        ? installMessages.clear.cleared
        : installMessages.clear.nothingToClear,
    );
  }
}
