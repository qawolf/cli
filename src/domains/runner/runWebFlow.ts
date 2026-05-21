import crypto from "node:crypto";
import os from "node:os";
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
import type {
  MinimalBrowser,
  MinimalBrowserContext,
  WebLaunchDeps,
  WebLaunchOptions,
} from "./web/types.js";
import { FailWithoutRetryError } from "./errors.js";
import { initFlowRuntime } from "./initFlowRuntime.js";
import {
  normalizeBrowserName,
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

  const exported = await loadFlowDefault<WebFlowApiReturnValue>(flowPath);

  const isLegacy = typeof exported === "function";
  const flowName = isLegacy
    ? path.basename(flowPath, path.extname(flowPath))
    : (exported as WebFlowDefinition).name;
  const runFn = isLegacy
    ? (exported as WebFlowDefinition["run"])
    : (exported as WebFlowDefinition).run;

  const openBrowsers: MinimalBrowser[] = [];
  const openContexts: MinimalBrowserContext[] = [];
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

  const launch = async (launchOpts?: {
    browser?: "chrome" | "chromium" | "firefox" | "msedge" | "webkit";
    persistentContext?: boolean;
    userDataDir?: string;
  }) => {
    const browserName = normalizeBrowserName(launchOpts?.browser);
    const bt = deps[browserName];

    if (launchOpts?.persistentContext === true) {
      const userDataDir =
        launchOpts.userDataDir ??
        path.join(os.tmpdir(), `qawolf-${crypto.randomUUID()}`);
      const context = await bt.launchPersistentContext(userDataDir, {
        ...launchBrowserOpts,
        ...contextSetup,
      });
      context.setDefaultTimeout(options.timeout);
      openContexts.push(context);
      const page = await context.newPage();
      return { browserType: browserName, context, page };
    }

    const browser = await bt.launch(launchBrowserOpts);
    openBrowsers.push(browser);
    const context = await browser.newContext(contextSetup);
    context.setDefaultTimeout(options.timeout);
    openContexts.push(context);
    return { browser, browserType: browserName, context };
  };

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
    await Promise.allSettled([
      ...openContexts.map((c) => c.close()),
      ...openBrowsers.map((b) => b.close()),
    ]);
    if (harPath !== undefined) {
      await maybeCleanupHar(deps.fs, harPath, passed, harMode);
    }
  }
}
