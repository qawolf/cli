import { join } from "node:path";
import type { RunnerDeps } from "./types.js";
import type { WebLaunchDeps } from "./web/types.js";
import {
  makeBrowser,
  makeContext,
  makeDep,
  makePage,
  makeUniformDeps,
} from "./web/createWebLaunchContext.fixtures.js";
import type { RunWebFlowDeps, RunWebFlowOptions } from "./runWebFlow.js";

export function makeRunnerDeps(): RunnerDeps {
  return {
    fs: {
      mkdir: async () => {},
      writeFile: async () => {},
      unlink: async () => {},
    },
    spawn: () => ({ exitCode: Promise.resolve(0), kill: () => {} }),
    signals: { register: () => () => {}, shutdown: async () => {} },
    createStorage: <T>() => ({
      run: async (_store: T, callback: () => Promise<void>) => callback(),
      getStore: () => undefined,
    }),
  };
}

export function makeWebDeps(webLaunchDeps?: WebLaunchDeps): RunWebFlowDeps {
  const ctx = makeContext([makePage()]);
  const browser = makeBrowser(ctx);
  const dep = makeDep(browser, ctx);
  return {
    ...makeRunnerDeps(),
    ...(webLaunchDeps ?? makeUniformDeps(dep)),
  };
}

export const baseOptions: RunWebFlowOptions = {
  retries: 0,
  outputDir: "/tmp/qawolf-test",
  headed: false,
  slowMo: 0,
  video: "off",
  timeout: 30_000,
};

export function fixturePath(name: string): string {
  return join(import.meta.dirname, `runWebFlow.${name}.fixture.ts`);
}
