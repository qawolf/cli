import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

import { checkApiKey } from "./apiKey.js";
import { checkApiUrl } from "./apiUrl.js";
import { checkFileAssets } from "./fileAssets.js";
import { checkNodeVersion } from "./nodeVersion.js";
import { checkNpmRegistry } from "./npmRegistry.js";
import { checkPlaywright } from "./playwright.js";

type CheckDeps = {
  readonly apiKey: string | undefined;
  readonly fetch: typeof globalThis.fetch;
  readonly spawn: SpawnFn;
  readonly apiBaseUrl: string;
  readonly enginesNode: string;
  readonly processVersion: string;
  readonly flowFiles: readonly string[];
  readonly readFile: (path: string) => Promise<string>;
  readonly cwd: string;
  readonly playwrightCliPath: string | undefined;
};

export async function runChecks(deps: CheckDeps): Promise<CheckResult[]> {
  const [nodeVer, playwright, apiKey, apiUrl, npmRegistry, fileAssets] =
    await Promise.all([
      checkNodeVersion({
        processVersion: deps.processVersion,
        enginesNode: deps.enginesNode,
      }),
      checkPlaywright({
        spawn: deps.spawn,
        playwrightCliPath: deps.playwrightCliPath,
      }),
      checkApiKey({ apiKey: deps.apiKey }),
      checkApiUrl({ fetch: deps.fetch, apiBaseUrl: deps.apiBaseUrl }),
      checkNpmRegistry({ spawn: deps.spawn }),
      checkFileAssets({
        files: deps.flowFiles,
        readFile: deps.readFile,
        cwd: deps.cwd,
      }),
    ]);
  return [nodeVer, playwright, apiKey, apiUrl, npmRegistry, ...fileAssets];
}
