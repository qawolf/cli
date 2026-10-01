import path from "node:path";

import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";

import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import { matchesSelectors, type FlowSelectors } from "~/core/flowSelectors.js";
import {
  flowBasename,
  targetToBrowser,
  type PeekFlowMetaFn,
} from "~/core/flowMeta.js";
import { envLabelFor, readEnvLabels } from "./envLabels.js";
import { selectPulledEnv } from "./selectPulledEnv.js";
import { emptySelectionResult, tagsNotCachedResult } from "./selectorGuards.js";
import { renderFlowsList } from "./renderFlowsList.js";
import { filterFlows } from "./filterFlows.js";
import { type FlowsListItem, toListRow } from "./listItem.js";
import { type ListView, printedView, unavailableView } from "./listView.js";
import type { CachedFlow } from "./readCachedFlows.js";
import { renderListTable } from "./renderListTable.js";

export type FlowsListDeps = {
  readonly cwd: string;
  readonly expandPatterns: (
    patterns: string[],
    cwd: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
  /** What each flow's pull recorded, keyed by absolute flow path. */
  readonly readCachedFlows: (
    files: readonly string[],
  ) => Promise<ReadonlyMap<string, CachedFlow>>;
  /** Human label for a pulled env dir — its slug, name, or id. */
  readonly readEnvLabel: (envDir: string) => Promise<string>;
  /** Resolves an id, slug, or name to a pulled env, without the API. */
  readonly findPulledEnv: (
    ref: string,
  ) => Promise<{ dir: string; envId: string } | undefined>;
  /** Every pulled env dir on disk, for naming what --env could refer to. */
  readonly listPulledEnvDirs: () => Promise<string[]>;
};

export async function flowsList(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: FlowsListDeps,
  selectors: FlowSelectors & { env?: string | undefined } = { tags: [] },
  view: ListView = printedView,
): Promise<CommandResult> {
  const unavailable = unavailableView(ctx, view);
  if (unavailable !== undefined) return unavailable;

  const patterns = pattern ? [pattern] : [];
  let files = await deps.expandPatterns(patterns, deps.cwd);

  // --env without --remote names a pulled environment, so it is answered from
  // disk: no auth, no network, and the error can list what is actually here.
  if (selectors.env !== undefined) {
    const selection = await selectPulledEnv({
      files,
      ref: selectors.env,
      findPulledEnv: deps.findPulledEnv,
      listPulledEnvDirs: deps.listPulledEnvDirs,
      readEnvLabel: deps.readEnvLabel,
    });
    if (selection.kind === "unknown") return selection.result;
    files = selection.files;
  }
  const cached = await deps.readCachedFlows(files);
  const cachedTags = new Map<string, readonly string[]>();
  for (const [file, flow] of cached) {
    if (flow.tags !== undefined) cachedTags.set(file, flow.tags);
  }
  const envLabels = await readEnvLabels(files, deps.readEnvLabel);

  const notCached = tagsNotCachedResult(selectors, cachedTags);
  if (notCached !== undefined) return notCached;

  const all: FlowsListItem[] = [];
  for await (const { file, ...meta } of batchMap(
    files,
    async (f) => ({ file: f, ...(await deps.peekFlowMeta(f)) }),
    flowBatchSize,
  )) {
    all.push({
      file: path.relative(deps.cwd, file),
      name: meta.name ?? flowBasename(file),
      flowId: cached.get(file)?.flowId,
      env: envLabelFor(file, envLabels),
      tags: cached.get(file)?.tags,
      target: meta.target,
      browser: meta.target ? targetToBrowser(meta.target) : undefined,
    });
  }

  const items = all.filter((item) => matchesSelectors(item, selectors));
  // No team tag list offline, so a miss is reported as a miss, never a typo.
  const empty = await emptySelectionResult(selectors, items.length, undefined);
  if (empty !== undefined) return empty;

  if (view.interactive) {
    return filterFlows(ctx.ui, items.map(toListRow), view);
  }
  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info(runnerMessages.noFlowsMatched);
    return;
  }
  const rows = items.map(toListRow);
  if (ctx.ui.mode === "agent") {
    ctx.ui.write(renderListTable(rows, false));
    return;
  }
  ctx.ui.gap();
  ctx.ui.intro(flowsMessages.title);
  ctx.ui.write(renderFlowsList(rows, { styled: true, columns: view.columns }));
  ctx.ui.outro(flowsMessages.flowCount(items.length));
}
