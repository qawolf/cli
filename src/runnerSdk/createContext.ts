import { makeInteractiveRunnerDeps } from "~/domains/interactiveRunner/deps.js";
import type { InteractiveRunnerDeps } from "~/domains/interactiveRunner/deps.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import { resolveHostUrl } from "~/shell/resolveHostUrl.js";

import type { RunnerSdkOptions } from "./types.js";

export type SdkContextOptions = RunnerSdkOptions & {
  fs?: Fs | undefined;
  logger?: Logger | undefined;
};

export type SdkContext = {
  deps: InteractiveRunnerDeps;
  platformClient: PlatformClient;
};

export function createSdkContext(options: SdkContextOptions): SdkContext {
  const cwd = options.cwd ?? process.cwd();
  const fs = options.fs ?? makeDefaultFs();
  const baseUrl = options.baseUrl ?? resolveHostUrl(process.env);

  return {
    deps: makeInteractiveRunnerDeps({ cwd, env: process.env, fs }),
    platformClient: createPlatformClient(options.apiKey, {
      baseUrl,
      fetch: options.fetch ?? globalThis.fetch,
      fs,
      ...(options.logger ? { logger: options.logger } : {}),
    }),
  };
}
