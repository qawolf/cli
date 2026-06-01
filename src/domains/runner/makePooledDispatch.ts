import { defaultSpawn } from "~/shell/spawn.js";
import { defaultWorkerCommand } from "~/shell/workerCommand.js";

import { createSubprocessDispatch } from "./dispatchViaSubprocess.js";
import type { FlowsRunDeps } from "./runInternals.js";

/**
 * Composite-root factory for the `--workers > 1` dispatch: binds the real
 * spawn and self-invocation command to the resolved env dir, leaving the run
 * options to be supplied per run by `flowsRun`.
 */
export function makePooledDispatch(
  resolvedDir: string,
): NonNullable<FlowsRunDeps["createPooledDispatch"]> {
  return ({ webOptions, androidOptions }) =>
    createSubprocessDispatch({
      spawn: defaultSpawn,
      ...defaultWorkerCommand(),
      resolvedDir,
      webOptions,
      androidOptions,
    });
}
