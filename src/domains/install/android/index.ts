import { isAndroidTarget, type PeekFlowMetaFn } from "~/core/flowMeta.js";
import { pluralize } from "~/core/pluralize.js";
import { avdNameForTarget, buildSystemImage } from "~/core/androidTargets.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { parseExecutionTarget } from "@qawolf/flow-targets";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { SpawnFn } from "~/shell/spawn.js";
import { installAvds } from "./avd.js";
import type { AvdSpec } from "./avd.js";
import { installUiautomator2Driver } from "./driver.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import { installMessages } from "~/core/messages/index.js";

export type InstallAndroidDeps = {
  readonly cwd: string;
  readonly spawn: SpawnFn;
  /** Injected so tests can assert specific arch-dependent system image strings. */
  readonly arch: NodeJS.Architecture;
  readonly androidHome: string;
  readonly checkExists: (path: string) => boolean;
  readonly sdkManagerPath: string;
  readonly avdManagerPath: string;
  readonly expandPatterns: (
    patterns: string[],
    cwd?: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
  /** Resolves the env dir (package.json ancestor) from expanded flow files. */
  readonly resolveEnvDir: (files: string[]) => string | undefined;
  /** Resolves the appium binary path from an env dir. */
  readonly resolveAppiumBin: (envDir: string) => string;
};

export async function installAndroid(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: InstallAndroidDeps,
): Promise<CommandResult> {
  const patterns = buildPatternArgs(pattern);
  const files = await deps.expandPatterns(patterns, deps.cwd);

  const targets = await collectAndroidTargets(files, deps.peekFlowMeta);
  if (targets.length === 0) {
    ctx.ui.info(installMessages.android.noFlowsFound);
    return;
  }

  const specs = buildAvdSpecs(targets, deps.arch);

  await installAvds(ctx, specs, {
    spawn: deps.spawn,
    sdkManagerPath: deps.sdkManagerPath,
    avdManagerPath: deps.avdManagerPath,
    androidHome: deps.androidHome,
    checkExists: deps.checkExists,
  });

  const envDir = deps.resolveEnvDir(files) ?? deps.cwd;
  await installUiautomator2Driver(ctx, {
    spawn: deps.spawn,
    appiumBinPath: deps.resolveAppiumBin(envDir),
  });

  ctx.ui.success(
    `Android install complete. ${pluralize(specs.length, "unique AVD")} ready.`,
  );
}

async function collectAndroidTargets(
  files: readonly string[],
  peekFlowMeta: PeekFlowMetaFn,
): Promise<string[]> {
  const seen = new Set<string>();
  for await (const meta of batchMap(files, peekFlowMeta, flowBatchSize)) {
    if (meta.target && isAndroidTarget(meta.target)) {
      seen.add(meta.target);
    }
  }
  return [...seen];
}

// deviceModel from parseExecutionTarget matches the avdmanager device ID directly
// (e.g. "pixel_9"), so no separate mapping is needed.
// Cast matches the pattern in runAndroidFlowUtils.ts.
type ParseArg = Parameters<typeof parseExecutionTarget>[0];

function buildAvdSpecs(
  targets: readonly string[],
  arch: NodeJS.Architecture,
): AvdSpec[] {
  const seen = new Map<string, AvdSpec>();
  for (const target of targets) {
    const avdName = avdNameForTarget(target);
    if (!avdName || seen.has(avdName)) continue;
    // Re-parse to get systemImage and deviceId. avdNameForTarget already
    // confirmed this is a valid Android target so the parse won't throw here.
    const parsed = parseExecutionTarget(target as ParseArg);
    if (parsed.platform !== "android") continue;
    const { deviceModel, androidVersion } = parsed.meta;
    seen.set(avdName, {
      avdName,
      systemImage: buildSystemImage(androidVersion, arch),
      deviceId: deviceModel,
    });
  }
  return [...seen.values()];
}
