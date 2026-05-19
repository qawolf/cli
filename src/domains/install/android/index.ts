import { isAndroidTarget } from "~/core/flowMeta.js";
import { pluralize } from "~/core/pluralize.js";
import { buildSystemImage, makeAvdName } from "~/core/androidTargets.js";
import { parseExecutionTarget } from "@qawolf/flow-targets";
import type { AndroidExecutionTarget } from "@qawolf/flow-targets";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { SpawnFn } from "~/shell/spawn.js";
import { installAvds } from "./avd.js";
import type { AvdSpec } from "./avd.js";
import { installUiautomator2Driver } from "./driver.js";

type PeekFlowMetaFn = (
  filePath: string,
) => Promise<{ name: string | undefined; target: string | undefined }>;

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
  const patterns = pattern ? [pattern] : [];
  const files = await deps.expandPatterns(patterns, deps.cwd);

  const targets = await collectAndroidTargets(files, deps.peekFlowMeta);
  if (targets.length === 0) {
    ctx.ui.info("No Android flows found. Nothing to install.");
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

const batchSize = 32;

async function collectAndroidTargets(
  files: readonly string[],
  peekFlowMeta: PeekFlowMetaFn,
): Promise<string[]> {
  const seen = new Set<string>();
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map(peekFlowMeta));
    for (const meta of metas) {
      if (meta.target && isAndroidTarget(meta.target)) {
        seen.add(meta.target);
      }
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
    let parsed: ReturnType<typeof parseExecutionTarget>;
    try {
      parsed = parseExecutionTarget(target as ParseArg);
    } catch {
      continue;
    }
    if (parsed.platform !== "android") continue;
    const { deviceModel, androidVersion } = (
      parsed as unknown as AndroidExecutionTarget
    ).meta;
    const avdName = makeAvdName(deviceModel, androidVersion);
    if (!seen.has(avdName)) {
      seen.set(avdName, {
        avdName,
        systemImage: buildSystemImage(androidVersion, arch),
        deviceId: deviceModel,
      });
    }
  }
  return [...seen.values()];
}
