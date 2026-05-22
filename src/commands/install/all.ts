import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { classifyTarget, type PeekFlowMetaFn } from "~/core/flowMeta.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { errorMessage } from "~/core/errors.js";
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
  readonly installBrowsers: (
    ctx: CommandContext,
    pattern: string | undefined,
  ) => Promise<CommandResult>;
  readonly installAndroid: (
    ctx: CommandContext,
    pattern: string | undefined,
  ) => Promise<CommandResult>;
};

export async function installAll(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: InstallAllDeps,
): Promise<CommandResult> {
  const patterns = buildPatternArgs(pattern);
  const files = await deps.expandPatterns(patterns, deps.cwd);

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
    ctx.ui.info("No flows requiring installation were found.");
    return;
  }

  if (hasIos) {
    ctx.ui.warn("iOS targets are not supported in v0.1.");
  }

  if (!hasWeb && !hasAndroid) {
    return;
  }

  let firstError: { error: string; exitCode?: number } | undefined;

  if (hasWeb) {
    try {
      const result = await deps.installBrowsers(ctx, pattern);
      if (result) firstError = result;
    } catch (err: unknown) {
      if (!firstError) firstError = { error: errorMessage(err) };
    }
  }

  if (hasAndroid) {
    try {
      const result = await deps.installAndroid(ctx, pattern);
      if (result && !firstError) firstError = result;
    } catch (err: unknown) {
      if (!firstError) firstError = { error: errorMessage(err) };
    }
  }

  if (!firstError) {
    ctx.ui.success("Install complete.");
  }

  return firstError;
}

export async function handleInstall(
  ctx: CommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  return installAll(ctx, pattern, {
    cwd: process.cwd(),
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: (c, p) => handleInstallBrowsers(c, p),
    installAndroid: (c, p) => handleInstallAndroid(c, p),
  });
}
