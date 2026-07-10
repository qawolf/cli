import type { Command } from "commander";

import { errorMessage } from "~/core/errors.js";
import { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import type { Reporter } from "~/shell/reporter/types.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { getConfigDir } from "~/core/paths.js";
import { makeDefaultFs } from "~/shell/fs.js";
import { configureTestkit } from "~/shell/testkit.js";
import { executeWorkerFlow } from "~/domains/runner/executeWorkerFlow.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/domains/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/domains/runner/runWebFlow.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import type { FlowsRunDeps } from "~/domains/runner/runInternals.js";
import { parseWorkerInput } from "~/domains/runner/workerProtocol.js";
import { createFlowRuntimeDeps } from "./flowRuntimeDeps.js";

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks).toString("utf8");
}

// dispatchFlow never reads these; surface a bug rather than fake a value.
const unavailable = (name: string) => (): never => {
  throw new Error(`${name} is not available in a worker subprocess`);
};

async function runWorker(signals: SignalRegistry): Promise<void> {
  try {
    const input = parseWorkerInput(await readStdin());
    if (input.flow.kind !== "web")
      throw new Error("worker subprocess currently supports web flows only");

    await configureTestkit(input.resolvedDir);
    const fs = makeDefaultFs();
    const apiBaseUrl =
      process.env["QAWOLF_API_URL"]?.replace(/\/+$/, "") ||
      "https://app.qawolf.com";
    const flowRuntimeDeps = await createFlowRuntimeDeps({
      envDir: input.resolvedDir,
      ctx: { apiBaseUrl, configDir: getConfigDir(), fs },
    });
    const runWebFlowDeps = {
      ...(await defaultRunWebFlowDeps(input.resolvedDir, signals)),
      flowRuntimeDeps,
    };
    const reporter: Reporter = {};
    const deps: FlowsRunDeps = {
      peekFlowMeta: unavailable("peekFlowMeta"),
      installBrowsers: unavailable("installBrowsers"),
      runWebFlow: defaultRunWebFlow,
      runWebFlowDeps,
      runAndroidFlow: defaultRunAndroidFlow,
      runAndroidFlowDeps: "not-wired",
      reporter,
      now: () => Date.now(),
      findFlowStamp: defaultFindFlowStamp,
      warn: (message) => process.stderr.write(`${message}\n`),
    };

    const line = await executeWorkerFlow(input, deps);
    process.stdout.write(`${line}\n`);
  } catch (err) {
    // A setup/infra failure with no result line: the parent's runWorkerOnce
    // turns the non-zero exit + stderr into a synthesized flow failure.
    process.stderr.write(`${errorMessage(err)}\n`);
    process.exitCode = 1;
  }
}

export function registerRunWorkerCommand(
  flows: Command,
  signals: SignalRegistry,
): void {
  flows
    .command("__run-worker <flowPath>", { hidden: true })
    .description(
      "Run a single flow in an isolated subprocess (used by 'flows run'; not intended for direct use)",
    )
    .action(() => runWorker(signals));
}
