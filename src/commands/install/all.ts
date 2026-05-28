import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveUniqueEnvDir as defaultResolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { classifyTarget, type PeekFlowMetaFn } from "~/core/flowMeta.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { errorMessage } from "~/core/errors.js";
import { installMessages } from "~/core/messages/index.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";

import { handleInstallAndroid } from "./android.js";
import { handleInstallBrowsers } from "./browsers.js";

export type InstallAllDeps = {
  readonly cwd: string;
  readonly expandPatterns: (
    patterns: string[],
    cwd?: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
  readonly resolveUniqueEnvDir: (files: string[]) => string | undefined;
  readonly installBrowsers: (
    ctx: CommandContext,
    pattern: string | undefined,
    envDir: string,
  ) => Promise<CommandResult>;
  readonly installAndroid: (
    ctx: CommandContext,
    pattern: string | undefined,
    envDir: string,
  ) => Promise<CommandResult>;
};

export async function installAll(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: InstallAllDeps,
): Promise<CommandResult> {
  const patterns = buildPatternArgs(pattern);
  const files = await deps.expandPatterns(patterns, deps.cwd);

  let envDir: string;
  try {
    envDir = deps.resolveUniqueEnvDir(files) ?? deps.cwd;
  } catch (err: unknown) {
    return { error: errorMessage(err), exitCode: 2 };
  }

  let hasWeb = false;
  let hasAndroid = false;
  let hasIos = false;

  for await (const meta of batchMap(files, deps.peekFlowMeta, flowBatchSize)) {
    if (!meta.target) continue;
    const classified = classifyTarget(meta.target);
    if (classified?.kind === "web") hasWeb = true;
    else if (classified?.kind === "android") hasAndroid = true;
    else if (classified?.kind === "ios") hasIos = true;
  }

  if (!hasWeb && !hasAndroid && !hasIos) {
    ctx.ui.info(installMessages.noFlowsFound);
    return;
  }

  if (hasIos) {
    ctx.ui.warn(installMessages.iosNotSupported);
  }

  if (!hasWeb && !hasAndroid) {
    return;
  }

  let firstError: { error: string; exitCode?: number } | undefined;

  if (hasWeb) {
    try {
      const result = await deps.installBrowsers(ctx, pattern, envDir);
      if (result) firstError = result;
    } catch (err: unknown) {
      if (!firstError) firstError = { error: errorMessage(err) };
    }
  }

  if (hasAndroid) {
    try {
      const result = await deps.installAndroid(ctx, pattern, envDir);
      if (result && !firstError) firstError = result;
    } catch (err: unknown) {
      if (!firstError) firstError = { error: errorMessage(err) };
    }
  }

  if (!firstError) {
    ctx.ui.success(installMessages.installComplete);
  }

  return firstError;
}

export async function handleInstall(
  ctx: CommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  const { fs } = ctx;
  return installAll(ctx, pattern, {
    cwd: process.cwd(),
    expandPatterns: (patterns, cwd) =>
      defaultExpandPatterns(patterns, cwd ?? process.cwd(), undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    resolveUniqueEnvDir: (files) => defaultResolveUniqueEnvDir(files, fs),
    installBrowsers: handleInstallBrowsers,
    installAndroid: handleInstallAndroid,
  });
}
