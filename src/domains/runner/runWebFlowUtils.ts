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
  const tracingEnabled = traceMode !== "off";
  let closed = false;

  // Ordered teardown shared by normal cleanup and signal-driven shutdown:
  // stop tracing, then close contexts, then close browsers. The order matters
  // because Playwright flushes HAR/video during context.close() and writes the
  // trace on tracing.stop(); a browser.close() racing either can terminate the
  // connection mid-flush and silently drop the artifact.
  // TODO WIZ-10839: a flow with multiple launch() calls stops every context to
  // the same tracePath, so only one trace zip survives (mirrors HAR).
  const closeAll = async () => {
    if (closed) return;
    closed = true;
    if (tracingEnabled && tracePath !== undefined) {
      await Promise.allSettled(
        openContexts.map((c) => c.tracing.stop({ path: tracePath })),
      );
    }
    await Promise.allSettled(openContexts.map((c) => c.close()));
    await Promise.allSettled(openBrowsers.map((b) => b.close()));
  };

  // Register the ordered teardown once. SignalRegistry runs cleanups
  // concurrently, so registering context and browser closes separately would
  // let browser.close() race the context flush on a SIGINT-interrupted run.
  const unregister = signals.register(closeAll);

  const trackContext = async (ctx: MinimalBrowserContext) => {
    openContexts.push(ctx);
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
    const context = await browser.newContext(contextSetup);
    context.setDefaultTimeout(timeout);
    await trackContext(context);
    return { browser, browserType: browserName, context };
  };

  const cleanup = async () => {
    unregister();
    await closeAll();
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
