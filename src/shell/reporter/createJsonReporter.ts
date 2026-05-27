import type { FlowStamp } from "~/shell/manifest/types.js";
import { flattenErrorChain, type SerializedError } from "./formatError.js";
import type { Reporter, RunSummary } from "./types.js";

type WriteSink = { write: (str: string) => void };

export type JsonReporterDeps = { stdout: WriteSink };

type Stamp = { envId: string; contentHash: string };

export type JsonEvent =
  | {
      type: "flow.start";
      name: string;
      path: string;
    }
  | {
      type: "flow.pass";
      name: string;
      path: string;
      tests: { passed: number; total: number };
      durationMs: number;
      stamp?: Stamp;
    }
  | {
      type: "flow.fail";
      name: string;
      path: string;
      error: SerializedError[];
      tests: { passed: number; total: number };
      durationMs: number;
      attempt: number;
      maxAttempts: number;
      stamp?: Stamp;
    }
  | {
      type: "run.complete";
      summary: RunSummary;
    };

function toStamp(manifest: FlowStamp | undefined): Stamp | undefined {
  if (!manifest) return undefined;
  return { envId: manifest.envId, contentHash: manifest.contentHash };
}

export function createJsonReporter(deps: JsonReporterDeps): Reporter {
  function emit(event: JsonEvent): void {
    deps.stdout.write(`${JSON.stringify(event)}\n`);
  }

  return {
    onFlowStart({ name, path }) {
      emit({ type: "flow.start", name, path });
    },

    onFlowPass({ name, path, tests, durationMs, manifest }) {
      const stamp = toStamp(manifest);
      emit({
        type: "flow.pass",
        name,
        path,
        tests,
        durationMs,
        ...(stamp ? { stamp } : {}),
      });
    },

    onFlowFail({
      name,
      path,
      err,
      tests,
      durationMs,
      attempt,
      maxAttempts,
      manifest,
    }) {
      const stamp = toStamp(manifest);
      emit({
        type: "flow.fail",
        name,
        path,
        error: flattenErrorChain(err),
        tests,
        durationMs,
        attempt,
        maxAttempts,
        ...(stamp ? { stamp } : {}),
      });
    },

    onRunComplete({ summary }) {
      emit({ type: "run.complete", summary });
    },
  };
}
