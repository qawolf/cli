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

export type FlowsListDeps = {
  readonly cwd: string;
  readonly expandPatterns: (
    patterns: string[],
    cwd: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
};

type FlowsListItem = {
  file: string;
  name: string;
  tags: readonly string[];
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

  const items: FlowsListItem[] = [];
  for await (const { file, ...meta } of batchMap(
    files,
    async (f) => ({ file: f, ...(await deps.peekFlowMeta(f)) }),
    flowBatchSize,
  )) {
    items.push({
      file: path.relative(deps.cwd, file),
      name: meta.name ?? flowBasename(file),
      tags: [],
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
  if (ctx.ui.mode === "agent") {
    ctx.ui.write(renderTable(items, false));
    return;
  }
  ctx.ui.gap();
  ctx.ui.intro(flowsMessages.title);
  ctx.ui.write(renderTable(items, true));
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
  });
}

const columns = ["name", "target", "file"] as const;
type Column = (typeof columns)[number];

const ansiBold = "\x1b[1m";
const ansiReset = "\x1b[0m";

function renderTable(
  items: readonly FlowsListItem[],
  boldHeader: boolean,
): string {
  const rows: Record<Column, string>[] = items.map((it) => ({
    name: it.name,
    target: it.target ?? "",
    file: it.file,
  }));
  const widths: Record<Column, number> = {
    name: Math.max("name".length, ...rows.map((r) => r.name.length)),
    target: Math.max("target".length, ...rows.map((r) => r.target.length)),
    file: Math.max("file".length, ...rows.map((r) => r.file.length)),
  };
  const header: Record<Column, string> = {
    name: "name",
    target: "target",
    file: "file",
  };
  const renderRow = (cells: Record<Column, string>): string =>
    columns
      .map((c) => cells[c].padEnd(widths[c]))
      .join("  ")
      .trimEnd();
  const headerLine = boldHeader
    ? `${ansiBold}${renderRow(header)}${ansiReset}`
    : renderRow(header);
  return [headerLine, ...rows.map(renderRow)].join("\n") + "\n";
}
