import { join } from "node:path";

import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { ensureRuntimeEnv } from "~/domains/runtimeEnv/index.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
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

  let depsRoot: string;
  if (envDir !== undefined) {
    depsRoot = envDir;
  } else {
    const cwd = process.cwd();
    const files = await defaultExpandPatterns(
      buildPatternArgs(pattern),
      cwd,
      undefined,
      fs,
    );
    let projectDir: string | undefined;
    try {
      projectDir = resolveUniqueEnvDir(files, fs);
    } catch {
      projectDir = undefined;
    }
    ({ depsRoot } = await ensureRuntimeEnv(
      projectDir !== undefined ? { projectDir } : {},
      { fs },
    ));
  }

  return installAndroid(ctx, pattern, {
    cwd: process.cwd(),
    spawn: defaultSpawn,
    arch: process.arch,
    androidHome,
    checkExists: (path: string) => fs.existsSync(path),
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
    expandPatterns: (patterns, cwd) =>
      defaultExpandPatterns(patterns, cwd ?? process.cwd(), undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    resolveEnvDir: () => depsRoot,
    resolveAppiumBin,
  });
}
