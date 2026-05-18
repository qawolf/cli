import type {
  BrowserDep,
  MinimalBrowser,
  MinimalBrowserContext,
  MinimalPage,
  MinimalVideo,
  WebLaunchDeps,
} from "./types.js";

export function makePage(video?: MinimalVideo): MinimalPage {
  return { video: () => video };
}

export function makeContext(
  initialPages: MinimalPage[] = [],
): MinimalBrowserContext {
  return {
    setDefaultTimeout: () => {},
    close: async () => {},
    pages: () => initialPages,
    tracing: { start: async () => {}, stop: async () => {} },
    newPage: async () => makePage(),
  };
}

export function makeBrowser(ctx: MinimalBrowserContext): MinimalBrowser {
  return {
    newContext: async () => ctx,
    close: async () => {},
  };
}

export function makeDep(
  browser: MinimalBrowser,
  ctx: MinimalBrowserContext,
): BrowserDep {
  return {
    launch: async () => browser,
    launchPersistentContext: async () => ctx,
  };
}

export function makeUniformDeps(dep: BrowserDep): WebLaunchDeps {
  return { chromium: dep, firefox: dep, webkit: dep };
}
