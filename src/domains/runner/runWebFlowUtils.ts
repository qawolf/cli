import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { SignalRegistry } from "./types.js";
import type {
  BrowserDep,
  ContextSetupOptions,
  MinimalBrowser,
  MinimalBrowserContext,
} from "./web/types.js";

type LaunchBrowserOpts = {
  headless: boolean;
  slowMo: number;
  executablePath?: string;
};

export type LaunchFn = (launchOpts?: {
  browser?: "chrome" | "chromium" | "firefox" | "msedge" | "webkit";
  persistentContext?: boolean;
  userDataDir?: string;
}) => Promise<
  | { browserType: string; context: MinimalBrowserContext; page: unknown }
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
  openBrowsers,
  openContexts,
  signals,
  timeout,
  unregisters,
}: {
  browsers: { chromium: BrowserDep; firefox: BrowserDep; webkit: BrowserDep };
  contextSetup: ContextSetupOptions;
  launchBrowserOpts: LaunchBrowserOpts;
  openBrowsers: MinimalBrowser[];
  openContexts: MinimalBrowserContext[];
  signals: SignalRegistry;
  timeout: number;
  unregisters: (() => void)[];
}): LaunchFn {
  const trackContext = (ctx: MinimalBrowserContext) => {
    openContexts.push(ctx);
    unregisters.push(signals.register(() => ctx.close()));
  };

  return async (launchOpts) => {
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
      trackContext(context);
      const page = await context.newPage();
      return { browserType: browserName, context, page };
    }

    const browser = await bt.launch(launchBrowserOpts);
    openBrowsers.push(browser);
    unregisters.push(signals.register(() => browser.close()));
    const context = await browser.newContext(contextSetup);
    context.setDefaultTimeout(timeout);
    trackContext(context);
    return { browser, browserType: browserName, context };
  };
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
    throw new Error(`${name} is not supported in the CLI runner`);
  };
}

export const unsupportedWebDepNames = [
  "launchElectron",
  "getInbox",
  "getOTP",
  "OTPAuth",
  "qawolf",
  "readQRCode",
  "runCommand",
  "saveBaselineScreenshot",
  "selectors",
  "devices",
  "fetchLatestEnvironmentVariables",
  "setEnvironmentVariable",
  "mountCifsShare",
  "startOpenVpn",
  "startWireGuard",
] as const;
