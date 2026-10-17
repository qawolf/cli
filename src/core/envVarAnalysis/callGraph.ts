import type ts from "typescript";

import { defaultEntrypoint } from "./callableResolution.js";
import {
  summarizeExecution,
  type ExecutionSummary,
  type WalkArgs,
} from "./executionSummary.js";
import type { EnvReads, FlowEnvVars } from "./types.js";

function mergeReads(target: EnvReads, source: EnvReads): boolean {
  const previousSize = target.names.size;
  const previousDynamic = target.dynamic;
  for (const name of source.names) target.names.add(name);
  target.dynamic ||= source.dynamic;
  return (
    target.names.size !== previousSize || target.dynamic !== previousDynamic
  );
}

/** Propagates complete summaries back to callers, including every member of a cycle. */
function propagateReads(summaries: Map<ts.Node, ExecutionSummary>): void {
  const callers = new Map<ts.Node, Set<ts.Node>>();
  for (const [caller, summary] of summaries) {
    for (const callee of summary.callees) {
      const entries = callers.get(callee) ?? new Set();
      entries.add(caller);
      callers.set(callee, entries);
    }
  }
  const pending = new Set(summaries.keys());
  for (const callee of pending) {
    pending.delete(callee);
    const source = summaries.get(callee);
    if (source === undefined) continue;
    for (const caller of callers.get(callee) ?? []) {
      const target = summaries.get(caller);
      if (target !== undefined && mergeReads(target.reads, source.reads))
        pending.add(caller);
    }
  }
}

export function collectEnvVarsByFlow(
  args: WalkArgs & { readonly flowFiles: readonly ts.SourceFile[] },
): Map<string, FlowEnvVars> {
  const roots = new Map<ts.SourceFile, ts.Node[]>();
  for (const flow of args.flowFiles) {
    const entrypoint = defaultEntrypoint(args.compiler, args.checker, flow);
    roots.set(flow, entrypoint === undefined ? [flow] : [flow, entrypoint]);
  }
  const summaries = new Map<ts.Node, ExecutionSummary>();
  const pending = new Set([...roots.values()].flat());
  for (const node of pending) {
    const summary = summarizeExecution(args, node);
    summaries.set(node, summary);
    for (const callee of summary.callees) pending.add(callee);
  }
  propagateReads(summaries);
  const byFlow = new Map<string, FlowEnvVars>();
  for (const [flow, entries] of roots) {
    const reads: EnvReads = { names: new Set(), dynamic: false };
    for (const entry of entries) {
      const summary = summaries.get(entry);
      if (summary !== undefined) mergeReads(reads, summary.reads);
    }
    byFlow.set(flow.fileName, {
      names: [...reads.names].sort(),
      mayBeIncomplete: reads.dynamic,
    });
  }
  return byFlow;
}
