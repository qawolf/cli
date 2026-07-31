import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveDepsRoot as resolveDepsRootHelper } from "~/commands/resolveDepsRoot.js";
import { installMessages } from "~/core/messages/index.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { androidSdkHome } from "~/shell/androidSdkHome.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { installAndroid } from "~/domains/install/android/index.js";

export async function handleInstallAndroid(
  ctx: CommandContext,
  pattern: string | undefined,
  envDir?: string,
): Promise<CommandResult> {
  const androidHome = androidSdkHome();
  if (!androidHome) {
    return { error: installMessages.androidSdkNotFound };
  }

  const { fs } = ctx;

  return installAndroid(ctx, pattern, {
    cwd: process.cwd(),
    spawn: defaultSpawn,
    arch: process.arch,
    androidHome,
    checkExists: (path: string) => fs.existsSync(path),
    platform: process.platform,
    expandPatterns: (patterns, cwd) =>
      defaultExpandPatterns(patterns, cwd ?? process.cwd(), undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    resolveDepsRoot: async (files) =>
      envDir ??
      (await resolveDepsRootHelper({ files, fs, platform: process.platform }))
        .depsRoot,
  });
}
