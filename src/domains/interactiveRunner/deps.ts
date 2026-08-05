import type { RunFiles } from "@qawolf/api-contracts/v1";

import { sleep as defaultSleep } from "~/core/sleep.js";
import type { Fs } from "~/shell/fs.js";
import { collectRunFiles } from "~/shell/interactiveRunner/collectRunFiles.js";
import { makeRunnerId } from "~/shell/interactiveRunner/makeRunnerId.js";
import {
  type RunnerStore,
  makeRunnerStore,
} from "~/shell/interactiveRunner/runnerStore.js";
import {
  type ScreenshotWrite,
  writeScreenshot,
} from "~/shell/interactiveRunner/writeScreenshot.js";
import { readStdin } from "~/shell/stdin.js";

/**
 * Everything about the machine these handlers touch, in one injectable bundle
 * so that a test drives them with an in-memory filesystem, a fixed id, piped
 * input it chose and a sleep that does not wait.
 */
export type InteractiveRunnerDeps = {
  collectRunFiles: () => Promise<RunFiles>;
  cwd: string;
  env: Record<string, string | undefined>;
  makeRunnerId: () => string;
  readFile: (path: string) => Promise<string>;
  readStdin: () => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  store: RunnerStore;
  writeScreenshot: (options: {
    imageJpegBase64: string;
    path: string;
  }) => Promise<ScreenshotWrite>;
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
    readFile: (path) => options.fs.readFile(path),
    readStdin,
    sleep: defaultSleep,
    store: makeRunnerStore({ cwd: options.cwd, fs: options.fs }),
    writeScreenshot: (screenshot) =>
      writeScreenshot({ ...screenshot, fs: options.fs }),
  };
}
