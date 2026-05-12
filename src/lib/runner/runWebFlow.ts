import crypto from "node:crypto";
import os from "node:os";
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
import {
  normalizeBrowserName,
  notSupported,
  unsupportedWebDepNames,
} from "./runWebFlowUtils.js";

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

  const videoSize = { width: 1280, height: 720 };
  const videosDir =
    options.artifactDir ?? path.join(options.outputDir, "videos");
  const contextSetup =
    options.video !== "off"
      ? {
          viewport: videoSize,
          screen: videoSize,
          recordVideo: { dir: videosDir, size: videoSize },
        }
      : { viewport: videoSize, screen: videoSize };

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
          const err = new Error("failWithoutRetry");
          err.name = "FailWithoutRetryError";
          throw err;
        },
      };
      await runFn(webDeps as unknown as Parameters<typeof runFn>[0]);
    },
  };

  const runner = createRunner({ deps, options });

  try {
    return await runner.run(flowDef);
  } finally {
    await Promise.allSettled([
      ...openContexts.map((c) => c.close()),
      ...openBrowsers.map((b) => b.close()),
    ]);
  }
}
