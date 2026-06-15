import path from "node:path";
import type {
  WebFlowApiReturnValue,
  WebFlowDefinition,
} from "@qawolf/flows/web";
import { loadFlowDefault } from "./loadFlowDefault.js";
import { createRunner } from "./createRunner.js";
import type {
  FlowDefinition,
  FlowDeps,
  FlowRunResult,
  RunnerDeps,
  RunnerOptions,
} from "./types.js";
import type { WebLaunchDeps, WebLaunchOptions } from "./web/types.js";
import { FailWithoutRetryError } from "./errors.js";
import { initFlowRuntime } from "./initFlowRuntime.js";
import {
  createLaunch,
  notSupported,
  unsupportedWebDepNames,
} from "./runWebFlowUtils.js";
import {
  buildContextSetup,
  initHar,
  initTrace,
  maybeCleanupHar,
  maybeCleanupTrace,
} from "./web/contextSetup.js";

export type RunWebFlowDeps = RunnerDeps & WebLaunchDeps;
export type RunWebFlowOptions = RunnerOptions &
  Omit<WebLaunchOptions, "browser">;

export async function runWebFlow({
  deps,
  options,
  flowPath,
}: {
  deps: RunWebFlowDeps;
  options: RunWebFlowOptions;
  flowPath: string;
}): Promise<FlowRunResult> {
  await initFlowRuntime(flowPath, { timeout: options.timeout });

  const exported = await loadFlowDefault<WebFlowApiReturnValue>(flowPath);

  const isLegacy = typeof exported === "function";
  const flowName = isLegacy
    ? path.basename(flowPath, path.extname(flowPath))
    : (exported as WebFlowDefinition).name;
  const runFn = isLegacy
    ? (exported as WebFlowDefinition["run"])
    : (exported as WebFlowDefinition).run;

  const { harMode, harPath } = await initHar(deps.fs, options, flowName);
  const { traceMode, tracePath } = await initTrace(deps.fs, options, flowName);
  const videoSize = { width: 1280, height: 720 };
  const contextSetup = buildContextSetup(videoSize, options, harPath);

  const launchBrowserOpts = {
    headless: !options.headed,
    slowMo: options.slowMo,
    ...(options.executablePath !== undefined
      ? { executablePath: options.executablePath }
      : {}),
  };

  const { launch, cleanup } = createLaunch({
    browsers: {
      chromium: deps.chromium,
      firefox: deps.firefox,
      webkit: deps.webkit,
    },
    contextSetup,
    launchBrowserOpts,
    signals: deps.signals,
    timeout: options.timeout,
    traceMode,
    tracePath,
  });

  const flowDef: FlowDefinition = {
    name: flowName,
    path: flowPath,
    callback: async (flowDeps: FlowDeps) => {
      const webDeps = {
        ...Object.fromEntries(
          unsupportedWebDepNames.map((name) => [name, notSupported(name)]),
        ),
        launch,
        launchWithGpu: launch,
        isGpuAvailable: () => false,
        inputs: flowDeps.flowInputs,
        workflowInputs: flowDeps.flowInputs,
        setOutput: flowDeps.setOutput,
        failWithoutRetry: () => {
          throw new FailWithoutRetryError("failWithoutRetry");
        },
      };
      await runFn(webDeps as unknown as Parameters<typeof runFn>[0]);
    },
  };

  const runner = createRunner({ deps, options });
  let passed = false;
  try {
    const result = await runner.run(flowDef);
    passed = result.passed;
    return result;
  } finally {
    await cleanup();
    if (harPath !== undefined) {
      await maybeCleanupHar(deps.fs, harPath, passed, harMode);
    }
    if (tracePath !== undefined) {
      await maybeCleanupTrace(deps.fs, tracePath, passed, traceMode);
    }
  }
}
