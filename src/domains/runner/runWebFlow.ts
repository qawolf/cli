import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  WebFlowApiReturnValue,
  WebFlowDefinition,
} from "@qawolf/flows/web";
import { createRunner } from "./createRunner.js";
import type {
  FlowDefinition,
  FlowDeps,
  FlowRunResult,
  RunnerDeps,
  RunnerOptions,
} from "./types.js";
import type {
  MinimalBrowser,
  MinimalBrowserContext,
  WebLaunchDeps,
  WebLaunchOptions,
} from "./web/types.js";
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
  maybeCleanupHar,
} from "./web/contextSetup.js";

export type RunWebFlowDeps = RunnerDeps & WebLaunchDeps;
// trace is not yet implemented
export type RunWebFlowOptions = RunnerOptions &
  Omit<WebLaunchOptions, "browser" | "trace">;

export async function runWebFlow({
  deps,
  options,
  flowPath,
}: {
  deps: RunWebFlowDeps;
  options: RunWebFlowOptions;
  flowPath: string;
}): Promise<FlowRunResult> {
  await initFlowRuntime(flowPath);

  const mod = (await import(pathToFileURL(flowPath).href)) as Record<
    string,
    unknown
  >;
  const exported = mod["default"] as WebFlowApiReturnValue | undefined;
  if (exported === undefined) {
    throw new Error(`No default export found in "${flowPath}"`);
  }

  const isLegacy = typeof exported === "function";
  const flowName = isLegacy
    ? path.basename(flowPath, path.extname(flowPath))
    : (exported as WebFlowDefinition).name;
  const runFn = isLegacy
    ? (exported as WebFlowDefinition["run"])
    : (exported as WebFlowDefinition).run;

  const openBrowsers: MinimalBrowser[] = [];
  const openContexts: MinimalBrowserContext[] = [];
  const unregisters: (() => void)[] = [];
  const { harMode, harPath } = await initHar(deps.fs, options, flowName);
  const videoSize = { width: 1280, height: 720 };
  const contextSetup = buildContextSetup(videoSize, options, harPath);

  const launchBrowserOpts = {
    headless: !options.headed,
    slowMo: options.slowMo,
    ...(options.executablePath !== undefined
      ? { executablePath: options.executablePath }
      : {}),
  };

  const launch = createLaunch({
    browsers: {
      chromium: deps.chromium,
      firefox: deps.firefox,
      webkit: deps.webkit,
    },
    contextSetup,
    launchBrowserOpts,
    openBrowsers,
    openContexts,
    signals: deps.signals,
    timeout: options.timeout,
    unregisters,
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
    for (const unreg of unregisters) unreg();
    await Promise.allSettled([
      ...openContexts.map((c) => c.close()),
      ...openBrowsers.map((b) => b.close()),
    ]);
    if (harPath !== undefined) {
      await maybeCleanupHar(deps.fs, harPath, passed, harMode);
    }
  }
}
