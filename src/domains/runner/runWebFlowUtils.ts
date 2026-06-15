import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { TraceMode } from "~/core/types.js";
import type { SignalRegistry } from "./types.js";
import { runnerMessages } from "~/core/messages/index.js";
import { unsupportedSharedDepNames } from "./unsupportedDepNames.js";
import type {
  BrowserDep,
  BrowserLaunchOptions,
  ContextSetupOptions,
  MinimalBrowser,
  MinimalBrowserContext,
  MinimalPage,
} from "./web/types.js";

export type LaunchFn = (launchOpts?: {
  browser?: "chrome" | "chromium" | "firefox" | "msedge" | "webkit";
  persistentContext?: boolean;
  userDataDir?: string;
}) => Promise<
  | { browserType: string; context: MinimalBrowserContext; page: MinimalPage }
  | {
      browser: MinimalBrowser;
      browserType: string;
      context: MinimalBrowserContext;
    }
>;

export function createLaunch({
  browsers,
  contextSetup,
  launchBrowserOpts,
  signals,
  timeout,
  traceMode = "off",
  tracePath,
}: {
  browsers: { chromium: BrowserDep; firefox: BrowserDep; webkit: BrowserDep };
  contextSetup: ContextSetupOptions;
  launchBrowserOpts: BrowserLaunchOptions;
  signals: SignalRegistry;
  timeout: number;
  traceMode?: TraceMode;
  tracePath?: string | undefined;
}): { launch: LaunchFn; cleanup: () => Promise<void> } {
  const openBrowsers: MinimalBrowser[] = [];
  const openContexts: MinimalBrowserContext[] = [];
  const unregisters: (() => void)[] = [];
  const tracingEnabled = traceMode !== "off";

  const trackContext = async (ctx: MinimalBrowserContext) => {
    openContexts.push(ctx);
    unregisters.push(signals.register(() => ctx.close()));
    if (tracingEnabled) {
      await ctx.tracing.start({ screenshots: true, snapshots: true });
    }
  };

  const launch: LaunchFn = async (launchOpts) => {
    const browserName = normalizeBrowserName(launchOpts?.browser);
    const bt = browsers[browserName];

    if (launchOpts?.persistentContext === true) {
      const userDataDir =
        launchOpts.userDataDir ??
        path.join(os.tmpdir(), `qawolf-${crypto.randomUUID()}`);
      const context = await bt.launchPersistentContext(userDataDir, {
        ...launchBrowserOpts,
        ...contextSetup,
      });
      context.setDefaultTimeout(timeout);
      await trackContext(context);
      const page = await context.newPage();
      return { browserType: browserName, context, page };
    }

    const browser = await bt.launch(launchBrowserOpts);
    openBrowsers.push(browser);
    unregisters.push(signals.register(() => browser.close()));
    const context = await browser.newContext(contextSetup);
    context.setDefaultTimeout(timeout);
    await trackContext(context);
    return { browser, browserType: browserName, context };
  };

  const cleanup = async () => {
    for (const unreg of unregisters) unreg();
    // Stop tracing before closing the context — Playwright writes the trace
    // zip on stop(), and stop() is not valid once the context has closed.
    if (tracingEnabled && tracePath !== undefined) {
      await Promise.allSettled(
        openContexts.map((c) => c.tracing.stop({ path: tracePath })),
      );
    }
    // Close contexts fully before browsers: Playwright flushes HAR/video/trace
    // during context.close(), and a concurrent browser.close() can terminate
    // the connection mid-flush, silently dropping those artifacts.
    await Promise.allSettled(openContexts.map((c) => c.close()));
    await Promise.allSettled(openBrowsers.map((b) => b.close()));
  };

  return { launch, cleanup };
}

export function normalizeBrowserName(
  browser?: "chrome" | "chromium" | "firefox" | "msedge" | "webkit",
): "chromium" | "firefox" | "webkit" {
  if (browser === "chrome" || browser === "msedge") return "chromium";
  if (browser === "firefox") return "firefox";
  if (browser === "webkit") return "webkit";
  return "chromium";
}

export function notSupported(name: string): () => never {
  return () => {
    throw new Error(runnerMessages.notSupportedInCli(name));
  };
}

export const unsupportedWebDepNames = [
  ...unsupportedSharedDepNames,
  "launchElectron",
  "readQRCode",
  "saveBaselineScreenshot",
  "selectors",
  "devices",
] as const;
