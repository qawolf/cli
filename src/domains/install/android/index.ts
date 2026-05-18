import { isAndroidTarget } from "~/core/flowMeta.js";
import { buildSystemImage, makeAvdName } from "~/core/androidTargets.js";
import { parseExecutionTarget } from "@qawolf/flow-targets";
import type { AndroidExecutionTarget } from "@qawolf/flow-targets";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { SpawnFn } from "~/shell/spawn.js";
import { installAvds } from "./avd.js";
import type { AvdSpec } from "./avd.js";
import { installUiautomator2Driver } from "./driver.js";

// Local mirror of @qawolf/flow-targets AndroidPresetLiteral.
// Update when a new Android preset is added to the package.
type AndroidPresetLiteral =
  | "Android - Pixel"
  | "Android - Pixel 2 (Android 14)"
  | "Android - Pixel 9"
  | "Android - Pixel 9 (Android 14)"
  | "Android - Pixel 9 (Android 15)"
  | "Android - Pixel 9 (Android 16)"
  | "Android - Pixel Tablet (Android 14)"
  | "Android - Tablet";

// Maps each preset to the avdmanager hardware-profile device ID.
// "pixel_5" is used for Pixel 9 presets — no dedicated "pixel_9" profile exists in current cmdline-tools.
const androidTargetSpecs: Record<AndroidPresetLiteral, { deviceId: string }> = {
  "Android - Pixel": { deviceId: "pixel_2" },
  "Android - Pixel 2 (Android 14)": { deviceId: "pixel_2" },
  "Android - Pixel 9": { deviceId: "pixel_5" },
  "Android - Pixel 9 (Android 14)": { deviceId: "pixel_5" },
  "Android - Pixel 9 (Android 15)": { deviceId: "pixel_5" },
  "Android - Pixel 9 (Android 16)": { deviceId: "pixel_5" },
  "Android - Pixel Tablet (Android 14)": { deviceId: "pixel_tablet" },
  "Android - Tablet": { deviceId: "pixel_tablet" },
};

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
    `Android install complete. ${specs.length} unique AVD(s) ready.`,
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

// parseExecutionTarget is called (rather than reading the values stored in
// ANDROID_TARGET_SPECS) to keep deviceModel and androidVersion authoritative
// from the @qawolf/flow-targets package — if a preset's metadata changes in
// a package update, AVD names and system images update automatically.
// Cast matches the pattern in runAndroidFlowUtils.ts.
type ParseArg = Parameters<typeof parseExecutionTarget>[0];

function buildAvdSpecs(
  targets: readonly string[],
  arch: NodeJS.Architecture,
): AvdSpec[] {
  const seen = new Map<string, AvdSpec>();
  for (const target of targets) {
    const spec = androidTargetSpecs[target as keyof typeof androidTargetSpecs];
    if (!spec) continue;
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
        deviceId: spec.deviceId,
      });
    }
  }
  return [...seen.values()];
}
