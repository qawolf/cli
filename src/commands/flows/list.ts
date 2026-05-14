import path from "node:path";

import type { CommandContext, CommandResult } from "~/lib/context.js";
import { pluralize } from "~/lib/pluralize.js";
import type { BrowserName } from "~/types.js";

import {
  expandPatterns,
  flowBasename,
  peekFlowMeta,
  targetToBrowser,
} from "./expand.js";

const batchSize = 32;

export type FlowsListDeps = {
  readonly cwd: string;
  readonly expandPatterns: typeof expandPatterns;
  readonly peekFlowMeta: typeof peekFlowMeta;
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
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map((f) => deps.peekFlowMeta(f)));
    for (const [j, meta] of metas.entries()) {
      const file = batch[j]!;
      items.push({
        file: path.relative(deps.cwd, file),
        name: meta.name ?? flowBasename(file),
        tags: [],
        target: meta.target,
        browser: meta.target ? targetToBrowser(meta.target) : undefined,
      });
    }
  }

  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info("No flows matched.");
    return;
  }
  const isHuman = ctx.ui.mode === "human";
  if (isHuman) {
    ctx.ui.gap();
    ctx.ui.intro("Flows");
  }
  process.stdout.write(renderTable(items, isHuman));
  if (isHuman) {
    ctx.ui.outro(pluralize(items.length, "flow"));
  }
}

export function handleFlowsList(
  ctx: CommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  return flowsList(ctx, pattern, {
    cwd: process.cwd(),
    expandPatterns,
    peekFlowMeta,
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
