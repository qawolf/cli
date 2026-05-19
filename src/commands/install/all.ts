import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { classifyTarget } from "~/core/flowMeta.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";

import { handleInstallAndroid } from "./android.js";
import { handleInstallBrowsers } from "./browsers.js";

export type InstallAllDeps = {
  readonly cwd: string;
  readonly expandPatterns: (
    patterns: string[],
    cwd?: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: (
    filePath: string,
  ) => Promise<{ name: string | undefined; target: string | undefined }>;
  readonly installBrowsers: (
    ctx: CommandContext,
    pattern: string | undefined,
  ) => Promise<CommandResult>;
  readonly installAndroid: (
    ctx: CommandContext,
    pattern: string | undefined,
  ) => Promise<CommandResult>;
};

const batchSize = 32;

export async function installAll(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: InstallAllDeps,
): Promise<CommandResult> {
  const patterns = pattern ? [pattern] : [];
  const files = await deps.expandPatterns(patterns, deps.cwd);

  let hasWeb = false;
  let hasAndroid = false;
  let hasIos = false;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map(deps.peekFlowMeta));
    for (const meta of metas) {
      if (!meta.target) continue;
      const classified = classifyTarget(meta.target);
      if (classified?.kind === "web") hasWeb = true;
      else if (classified?.kind === "android") hasAndroid = true;
      else if (classified?.kind === "ios") hasIos = true;
    }
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
    const result = await deps.installBrowsers(ctx, pattern);
    if (result && !firstError) firstError = result;
  }

  if (hasAndroid) {
    const result = await deps.installAndroid(ctx, pattern);
    if (result && !firstError) firstError = result;
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
