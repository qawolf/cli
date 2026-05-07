import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
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
  UNSUPPORTED_WEB_DEP_NAMES,
} from "./runWebFlowUtils.js";

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
  const mod = (await import(flowPath)) as Record<string, unknown>;
  const exported = (mod["default"] ??
    Object.values(mod)[0]) as WebFlowApiReturnValue;

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

  const webDeps = {
    ...Object.fromEntries(
      UNSUPPORTED_WEB_DEP_NAMES.map((name) => [name, notSupported(name)]),
    ),
    launch,
    launchWithGpu: launch,
    isGpuAvailable: () => false,
    inputs: options.flowInputs ?? {},
    workflowInputs: options.flowInputs ?? {},
    setOutput: () => {},
    failWithoutRetry: () => {
      const err = new Error("failWithoutRetry");
      err.name = "FailWithoutRetryError";
      throw err;
    },
  };

  const flowDef: FlowDefinition = {
    name: flowName,
    path: flowPath,
    callback: async (_flowDeps: FlowDeps) => {
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
