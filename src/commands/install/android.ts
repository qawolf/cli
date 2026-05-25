import { join } from "node:path";
import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { resolveAppiumBin } from "~/shell/appium/resolveAppiumBin.js";
import { installMessages } from "~/core/messages/index.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { makeDefaultFs } from "~/shell/fs.js";
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

  // When envDir is pre-resolved (composite `qawolf install` path), use it
  // directly. Otherwise let installAndroid resolve from matched files.
  const resolveEnvDir = envDir
    ? () => envDir
    : (files: string[]) => {
        try {
          return resolveUniqueEnvDir(files);
        } catch {
          return undefined;
        }
      };

  return installAndroid(ctx, pattern, {
    cwd: process.cwd(),
    spawn: defaultSpawn,
    arch: process.arch,
    androidHome,
    checkExists: (path: string) => makeDefaultFs().existsSync(path),
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
    resolveEnvDir,
    resolveAppiumBin,
  });
}
