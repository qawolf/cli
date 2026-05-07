import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { BrowserName } from "~/types.js";
import type {
  CleanupResult,
  LaunchCallOptions,
  MinimalBrowser,
  MinimalBrowserContext,
  MinimalPage,
  WebLaunchContext,
  WebLaunchDeps,
  WebLaunchOptions,
} from "./types.js";

export function createWebLaunchContext({
  deps,
  options,
}: {
  deps: WebLaunchDeps;
  options: WebLaunchOptions;
}): WebLaunchContext {
  const openBrowsers: MinimalBrowser[] = [];
  const openContexts: MinimalBrowserContext[] = [];
  let cleanedUp = false;

  const browserMap: Record<BrowserName, typeof deps.chromium> = {
    chromium: deps.chromium,
    firefox: deps.firefox,
    webkit: deps.webkit,
  };

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

  const launchOpts = {
    headless: !options.headed,
    slowMo: options.slowMo,
    ...(options.executablePath !== undefined
      ? { executablePath: options.executablePath }
      : {}),
  };

  const launch = async (callOpts: LaunchCallOptions = {}): Promise<void> => {
    const bt = browserMap[options.browser];

    if (callOpts.browserContext === "persistent") {
      const userDataDir =
        callOpts.userDataDir ??
        path.join(os.tmpdir(), `qawolf-${crypto.randomUUID()}`);
      const context = await bt.launchPersistentContext(userDataDir, {
        ...launchOpts,
        ...contextSetup,
      });
      context.setDefaultTimeout(options.timeout);
      openContexts.push(context);
      return;
    }

    const browser = await bt.launch(launchOpts);
    openBrowsers.push(browser);
    const context = await browser.newContext(contextSetup);
    context.setDefaultTimeout(options.timeout);
    openContexts.push(context);
  };

  const pages = (): MinimalPage[] => openContexts.flatMap((ctx) => ctx.pages());

  const cleanup = async (_passed: boolean): Promise<CleanupResult> => {
    if (cleanedUp) return { videoPaths: [], tracePaths: [] };
    cleanedUp = true;

    await Promise.allSettled([
      ...openContexts.map((c) => c.close()),
      ...openBrowsers.map((b) => b.close()),
    ]);

    return { videoPaths: [], tracePaths: [] };
  };

  return { launch, pages, cleanup };
}
