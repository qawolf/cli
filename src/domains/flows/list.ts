import path from "node:path";

import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";
import type { BrowserName } from "~/core/types.js";

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
  /** Human label for a pulled env dir — its slug, name, or id. */
  readonly readEnvLabel: (envDir: string) => Promise<string>;
  /** Resolves an id, slug, or name to a pulled env, without the API. */
  readonly findPulledEnv: (
    ref: string,
  ) => Promise<{ dir: string; envId: string } | undefined>;
  /** Every pulled env dir on disk, for naming what --env could refer to. */
  readonly listPulledEnvDirs: () => Promise<string[]>;
};

type FlowsListItem = {
  file: string;
  name: string;
  // The pulled environment the flow came from. Undefined for project flows,
  // which belong to no environment.
  env: string | undefined;
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
  selectors: FlowSelectors & { env?: string | undefined } = { tags: [] },
): Promise<CommandResult> {
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
  const cachedTags = await deps.readCachedTags(files);
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
      env: envLabelFor(file, envLabels),
      tags: cachedTags.get(file),
      target: meta.target,
      browser: meta.target ? targetToBrowser(meta.target) : undefined,
    });
  }

  const items = all.filter((item) => matchesSelectors(item, selectors));
  // No team tag list offline, so a miss is reported as a miss, never a typo.
  const empty = await emptySelectionResult(selectors, items.length, undefined);
  if (empty !== undefined) return empty;

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
    env: it.env,
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
