import { join } from "node:path";
import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { resolveAppiumBin } from "~/shell/appium/resolveAppiumBin.js";
import { installMessages } from "~/core/messages/index.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { existsSync } from "~/shell/fs.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { installAndroid } from "~/domains/install/android/index.js";

export async function handleInstallAndroid(
  ctx: CommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  const androidHome =
    process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
  if (!androidHome) {
    return { error: installMessages.androidSdkNotFound };
  }

  return installAndroid(ctx, pattern, {
    cwd: process.cwd(),
    spawn: defaultSpawn,
    arch: process.arch,
    androidHome,
    checkExists: existsSync,
    sdkManagerPath: join(
      androidHome,
      "cmdline-tools",
      "latest",
      "bin",
      "sdkmanager",
    ),
    avdManagerPath: join(
      androidHome,
      "cmdline-tools",
      "latest",
      "bin",
      "avdmanager",
    ),
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    resolveEnvDir: (files) => {
      try {
        return resolveUniqueEnvDir(files);
      } catch {
        return undefined;
      }
    },
    resolveAppiumBin,
  });
}
