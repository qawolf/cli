import type { RunFile } from "@qawolf/api-contracts/v1";

import { sleep as defaultSleep } from "~/core/sleep.js";
import type { Fs } from "~/shell/fs.js";
import { collectRunFiles } from "~/shell/interactiveRunner/collectRunFiles.js";
import { makeRunnerId } from "~/shell/interactiveRunner/makeRunnerId.js";
import {
  type RunnerStore,
  makeRunnerStore,
} from "~/shell/interactiveRunner/runnerStore.js";

/**
 * Everything about the machine these handlers touch, in one injectable bundle
 * so that a test drives them with an in-memory filesystem, a fixed id and a
 * sleep that does not wait.
 */
export type InteractiveRunnerDeps = {
  collectRunFiles: () => Promise<RunFile[]>;
  cwd: string;
  env: Record<string, string | undefined>;
  makeRunnerId: () => string;
  sleep: (ms: number) => Promise<void>;
  store: RunnerStore;
};

export function makeInteractiveRunnerDeps(options: {
  cwd: string;
  env: Record<string, string | undefined>;
  fs: Fs;
}): InteractiveRunnerDeps {
  return {
    collectRunFiles: () =>
      collectRunFiles({ cwd: options.cwd, fs: options.fs }),
    cwd: options.cwd,
    env: options.env,
    makeRunnerId,
    sleep: defaultSleep,
    store: makeRunnerStore({ cwd: options.cwd, fs: options.fs }),
  };
}
