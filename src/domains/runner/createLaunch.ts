import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { TraceMode } from "~/core/types.js";
import type { SignalRegistry } from "./types.js";
import {
  type ArtifactPaths,
  createContextArtifacts,
} from "./web/artifactPaths.js";
import { normalizeBrowserName } from "./runWebFlowUtils.js";
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
}): {
  launch: LaunchFn;
  cleanup: () => Promise<void>;
  artifactPaths: () => ArtifactPaths;
} {
  const openBrowsers: MinimalBrowser[] = [];
  const openContexts: MinimalBrowserContext[] = [];
  const traceByContext = new Map<MinimalBrowserContext, string>();
  const tracingEnabled = traceMode !== "off";
  const { nextSetup, nextTracePath, artifactPaths } = createContextArtifacts(
    contextSetup,
    tracePath,
  );
  let closePromise: Promise<void> | undefined;

  // Ordered teardown shared by normal cleanup and signal-driven shutdown:
  // stop tracing, then close contexts, then close browsers. The order matters
  // because Playwright flushes HAR/video during context.close() and writes the
  // trace on tracing.stop(); a browser.close() racing either can terminate the
  // connection mid-flush and silently drop the artifact. Memoized so a caller
  // arriving mid-teardown awaits the same flush instead of returning early.
  const closeAll = (): Promise<void> => {
    closePromise ??= (async () => {
      if (tracingEnabled) {
        await Promise.allSettled(
          openContexts.map((c) => {
            const contextTracePath = traceByContext.get(c);
            return contextTracePath === undefined
              ? Promise.resolve()
              : c.tracing.stop({ path: contextTracePath });
          }),
        );
      }
      await Promise.allSettled(openContexts.map((c) => c.close()));
      await Promise.allSettled(openBrowsers.map((b) => b.close()));
    })();
    return closePromise;
  };

  // Register the ordered teardown once. SignalRegistry runs cleanups
  // concurrently, so registering context and browser closes separately would
  // let browser.close() race the context flush on a SIGINT-interrupted run.
  const unregister = signals.register(closeAll);

  const trackContext = async (ctx: MinimalBrowserContext, index: number) => {
    openContexts.push(ctx);
    if (tracingEnabled) {
      const contextTracePath = nextTracePath(index);
      if (contextTracePath !== undefined) {
        traceByContext.set(ctx, contextTracePath);
      }
      await ctx.tracing.start({ screenshots: true, snapshots: true });
    }
  };

  // Patches browser.newContext in place so flow-created contexts inherit
  // recording options and teardown tracking. Caller options win on conflicts.
  const instrumentBrowser = (browser: MinimalBrowser) => {
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (opts: ContextSetupOptions) => {
      const { setup, index } = nextSetup(opts);
      const context = await originalNewContext(setup);
      context.setDefaultTimeout(timeout);
      await trackContext(context, index);
      return context;
    };
  };

  const launch: LaunchFn = async (launchOpts) => {
    const browserName = normalizeBrowserName(launchOpts?.browser);
    const bt = browsers[browserName];

    if (launchOpts?.persistentContext === true) {
      const userDataDir =
        launchOpts.userDataDir ??
        path.join(os.tmpdir(), `qawolf-${crypto.randomUUID()}`);
      const { setup, index } = nextSetup();
      const context = await bt.launchPersistentContext(userDataDir, {
        ...launchBrowserOpts,
        ...setup,
      });
      context.setDefaultTimeout(timeout);
      await trackContext(context, index);
      const page = await context.newPage();
      return { browserType: browserName, context, page };
    }

    const browser = await bt.launch(launchBrowserOpts);
    openBrowsers.push(browser);
    instrumentBrowser(browser);
    // Instrumented above, so this call assigns setup and tracking itself.
    const context = await browser.newContext({});
    return { browser, browserType: browserName, context };
  };

  const cleanup = async () => {
    unregister();
    await closeAll();
  };

  return { launch, cleanup, artifactPaths };
}
