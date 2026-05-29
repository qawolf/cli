import type { SpawnFn } from "~/shell/spawn.js";

import { FlowRunError } from "./errors.js";
import type { DispatchResult } from "./runFlowsPooled.js";
import type { ResolvedFlow } from "./runInternals.js";
import { parseWorkerResult } from "./workerProtocol.js";

function lastNonEmptyLine(text: string): string | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[lines.length - 1];
}

/**
 * Runs a single flow in a fresh subprocess (the hidden `flows __run-worker`
 * command) and parses its JSON result. A separate process gives each flow its
 * own realm, isolating the `@qawolf/flows` global runtime. The flow path goes
 * on argv; run options go on stdin. A crash with no parseable result line is
 * reported as a synthesized flow failure rather than throwing.
 */
export async function runWorkerOnce(args: {
  spawn: SpawnFn;
  command: string;
  prefixArgs: readonly string[];
  flow: ResolvedFlow;
  optionsJson: string;
}): Promise<DispatchResult> {
  const { spawn, command, prefixArgs, flow, optionsJson } = args;
  const result = await spawn(
    command,
    [...prefixArgs, "flows", "__run-worker", flow.file],
    { stdin: optionsJson },
  );

  const line = lastNonEmptyLine(result.stdout);
  if (line !== undefined) return parseWorkerResult(line);

  const detail =
    result.stderr.trim() || `worker exited with code ${result.exitCode}`;
  return {
    run: {
      passed: false,
      testCounts: { passed: 0, total: 0 },
      attempts: 1,
      error: new FlowRunError(flow.name, 1, new Error(detail)),
    },
    durationMs: 0,
  };
}
