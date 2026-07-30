import { avdManagerBin, sdkManagerBin } from "~/core/androidBins.js";
import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveDepsRoot as resolveDepsRootHelper } from "~/commands/resolveDepsRoot.js";
import { installMessages } from "~/core/messages/index.js";
import { resolveAppiumBin } from "~/shell/appium/resolveAppiumBin.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { installAndroid } from "~/domains/install/android/index.js";

export async function handleInstallAndroid(
  ctx: CommandContext,
  pattern: string | undefined,
  envDir?: string,
): Promise<CommandResult> {
  const androidHome =
    process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
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
    sdkManagerPath: sdkManagerBin(androidHome, process.platform),
    avdManagerPath: avdManagerBin(androidHome, process.platform),
    expandPatterns: (patterns, cwd) =>
      defaultExpandPatterns(patterns, cwd ?? process.cwd(), undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    resolveDepsRoot: async (files) =>
      envDir ?? (await resolveDepsRootHelper({ files, fs })).depsRoot,
    resolveAppiumBin: (dir) => resolveAppiumBin(dir, process.platform),
  });
}
