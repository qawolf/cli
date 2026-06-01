import { dispatchFlow } from "./runInternals.js";
import type { FlowsRunDeps } from "./runInternals.js";
import { serializeWorkerResult } from "./workerProtocol.js";
import type { WorkerInput } from "./workerProtocol.js";

/**
 * Runs a single flow inside a worker subprocess and returns the serialized
 * result line for stdout. Reuses {@link dispatchFlow} verbatim — `deps` carries
 * a no-op reporter, since the parent pool owns the real reporter and re-emits
 * events from the parsed result.
 */
export async function executeWorkerFlow(
  input: WorkerInput,
  deps: FlowsRunDeps,
  dispatch: typeof dispatchFlow = dispatchFlow,
): Promise<string> {
  const { run, durationMs } = await dispatch({
    deps,
    flow: input.flow,
    webOptions: input.webOptions,
    androidOptions: input.androidOptions,
  });
  return serializeWorkerResult(run, durationMs);
}
