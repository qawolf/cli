import path from "node:path";

import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";
import type { BrowserName } from "~/core/types.js";

import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import {
  flowBasename,
  targetToBrowser,
  type PeekFlowMetaFn,
} from "~/core/flowMeta.js";
import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "./expand.js";
import { readCachedTags as defaultReadCachedTags } from "./readCachedTags.js";
import { renderListTable } from "./renderListTable.js";

export type FlowsListDeps = {
  readonly cwd: string;
  readonly expandPatterns: (
    patterns: string[],
    cwd: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
  /** Tags cached at pull time, keyed by absolute flow path. */
  readonly readCachedTags: (
    files: readonly string[],
  ) => Promise<Map<string, readonly string[]>>;
};

type FlowsListItem = {
  file: string;
  name: string;
  // Absent when the flow was never pulled, so its tags are unknown rather
  // than known to be empty.
  tags: readonly string[] | undefined;
  target: string | undefined;
  browser: BrowserName | undefined;
};

export async function flowsList(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: FlowsListDeps,
): Promise<CommandResult> {
  const patterns = pattern ? [pattern] : [];
  const files = await deps.expandPatterns(patterns, deps.cwd);
  const cachedTags = await deps.readCachedTags(files);

  const items: FlowsListItem[] = [];
  for await (const { file, ...meta } of batchMap(
    files,
    async (f) => ({ file: f, ...(await deps.peekFlowMeta(f)) }),
    flowBatchSize,
  )) {
    items.push({
      file: path.relative(deps.cwd, file),
      name: meta.name ?? flowBasename(file),
      tags: cachedTags.get(file),
      target: meta.target,
      browser: meta.target ? targetToBrowser(meta.target) : undefined,
    });
  }

  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info(runnerMessages.noFlowsMatched);
    return;
  }
  const rows = items.map((it) => ({
    name: it.name,
    target: it.target ?? "",
    tags: it.tags,
    file: it.file,
  }));
  if (ctx.ui.mode === "agent") {
    ctx.ui.write(renderListTable(rows, false));
    return;
  }
  ctx.ui.gap();
  ctx.ui.intro(flowsMessages.title);
  ctx.ui.write(renderListTable(rows, true));
  ctx.ui.outro(flowsMessages.flowCount(items.length));
}

export function handleFlowsList(
  ctx: CommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  const { fs } = ctx;
  return flowsList(ctx, pattern, {
    cwd: process.cwd(),
    expandPatterns: (patterns, cwd) =>
      defaultExpandPatterns(patterns, cwd, undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    readCachedTags: (files) => defaultReadCachedTags(files, fs),
  });
}
