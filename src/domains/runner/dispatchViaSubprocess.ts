import type { SpawnFn } from "~/shell/spawn.js";

import { FlowRunError } from "./errors.js";
import type { DispatchResult, PooledDispatch } from "./runFlowsPooled.js";
import type { RunAndroidFlowOptions } from "./runAndroidFlow.js";
import type { RunWebFlowOptions } from "./runWebFlow.js";
import type { ResolvedFlow } from "./runInternals.js";
import { parseWorkerResult, serializeWorkerInput } from "./workerProtocol.js";

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
  platform: NodeJS.Platform;
  workerEnv?: Record<string, string | undefined> | undefined;
}): Promise<DispatchResult> {
  const { spawn, command, prefixArgs, flow, optionsJson, platform, workerEnv } =
    args;
  const result = await spawn(
    command,
    [...prefixArgs, "flows", "__run-worker", flow.file],
    workerEnv !== undefined
      ? { stdin: optionsJson, env: workerEnv, platform }
      : { stdin: optionsJson, platform },
  );

  const line = lastNonEmptyLine(result.stdout);
  if (line !== undefined) {
    try {
      return parseWorkerResult(line);
    } catch {
      // Fall through to synthesize a per-flow failure from malformed output.
    }
  }

  const detail =
    result.stderr.trim() ||
    line ||
    `worker exited with code ${result.exitCode}`;
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

/**
 * Builds the {@link PooledDispatch} the scheduler uses in production: each call
 * spawns a fresh worker subprocess for one flow. `resolvedDir` and the run
 * options are bound once and sent to every worker on stdin.
 */
export function createSubprocessDispatch(env: {
  spawn: SpawnFn;
  command: string;
  prefixArgs: readonly string[];
  workerEnv?: Record<string, string | undefined> | undefined;
  resolvedDir: string;
  platform: NodeJS.Platform;
  webOptions: RunWebFlowOptions;
  androidOptions: RunAndroidFlowOptions;
}): PooledDispatch {
  return (flow) =>
    runWorkerOnce({
      spawn: env.spawn,
      command: env.command,
      prefixArgs: env.prefixArgs,
      platform: env.platform,
      workerEnv: env.workerEnv,
      flow,
      optionsJson: serializeWorkerInput({
        resolvedDir: env.resolvedDir,
        flow,
        webOptions: env.webOptions,
        androidOptions: env.androidOptions,
      }),
    });
}
