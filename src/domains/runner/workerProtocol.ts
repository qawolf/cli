import { errorMessage } from "~/core/errors.js";
import type { FlowStamp } from "~/shell/manifest/types.js";

import { FlowRunError } from "./errors.js";
import type { RunAndroidFlowOptions } from "./runAndroidFlow.js";
import type { RunWebFlowOptions } from "./runWebFlow.js";
import type { ResolvedFlow } from "./runInternals.js";
import type { FlowRunResult } from "./types.js";

// Parent → worker payload (sent on the worker subprocess's stdin). All fields
// are plain JSON. `resolvedDir` lets the worker rebuild its per-process deps
// (testkit, Playwright); env vars propagate via the inherited process env.
export type WorkerInput = {
  resolvedDir: string;
  flow: ResolvedFlow;
  webOptions: RunWebFlowOptions;
  androidOptions: RunAndroidFlowOptions;
};

export function serializeWorkerInput(input: WorkerInput): string {
  return JSON.stringify(input);
}

export function parseWorkerInput(text: string): WorkerInput {
  return JSON.parse(text) as WorkerInput;
}

// Wire form of a flow run, exchanged over the worker subprocess's stdout.
// Mirrors FlowRunResult but flattens the FlowRunError (an Error subclass) into
// plain JSON so it survives the process boundary, then rehydrates on parse.

type WireError = {
  flowName: string;
  attempt: number;
  message: string;
  stack?: string;
  cause?: { name: string; message: string; stack?: string };
};

type WireResult = {
  passed: boolean;
  testCounts: { passed: number; total: number };
  attempts: number;
  error?: WireError;
  manifest?: FlowStamp;
};

type WireMessage = { run: WireResult; durationMs: number };

function serializeError(err: FlowRunError): WireError {
  const cause = err.cause;
  const causeWire =
    cause instanceof Error
      ? {
          name: cause.name,
          message: cause.message,
          ...(cause.stack ? { stack: cause.stack } : {}),
        }
      : cause !== undefined
        ? { name: "Error", message: errorMessage(cause) }
        : undefined;
  return {
    flowName: err.flowName,
    attempt: err.attempt,
    message: err.message,
    ...(err.stack ? { stack: err.stack } : {}),
    ...(causeWire ? { cause: causeWire } : {}),
  };
}

function deserializeError(wire: WireError): FlowRunError {
  let cause: unknown;
  if (wire.cause) {
    const causeErr = new Error(wire.cause.message);
    causeErr.name = wire.cause.name;
    if (wire.cause.stack) causeErr.stack = wire.cause.stack;
    cause = causeErr;
  }
  const err = new FlowRunError(wire.flowName, wire.attempt, cause);
  if (wire.stack) err.stack = wire.stack;
  return err;
}

export function serializeWorkerResult(
  run: FlowRunResult,
  durationMs: number,
): string {
  const message: WireMessage = {
    durationMs,
    run: {
      passed: run.passed,
      testCounts: run.testCounts,
      attempts: run.attempts,
      ...(run.error ? { error: serializeError(run.error) } : {}),
      ...(run.manifest ? { manifest: run.manifest } : {}),
    },
  };
  return JSON.stringify(message);
}

export function parseWorkerResult(line: string): {
  run: FlowRunResult;
  durationMs: number;
} {
  const message = JSON.parse(line) as WireMessage;
  const run: FlowRunResult = {
    passed: message.run.passed,
    testCounts: message.run.testCounts,
    attempts: message.run.attempts,
    ...(message.run.error
      ? { error: deserializeError(message.run.error) }
      : {}),
    ...(message.run.manifest ? { manifest: message.run.manifest } : {}),
  };
  return { run, durationMs: message.durationMs };
}
