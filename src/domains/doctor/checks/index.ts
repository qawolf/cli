import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

import { checkAndroid } from "./android.js";
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
  readonly runAndroidChecks: boolean;
  readonly androidHome: string | undefined;
  readonly checkExists: (path: string) => boolean;
  readonly envDir: string | undefined;
  readonly resolveAppiumBin: (envDir: string) => string;
  readonly requiredAvds: readonly string[];
  readonly platform: NodeJS.Platform;
};

export async function runChecks(deps: CheckDeps): Promise<CheckResult[]> {
  const [
    nodeVer,
    playwright,
    apiKey,
    apiUrl,
    npmRegistry,
    fileAssets,
    android,
  ] = await Promise.all([
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
    checkNpmRegistry({ spawn: deps.spawn, platform: deps.platform }),
    checkFileAssets({
      files: deps.flowFiles,
      readFile: deps.readFile,
      cwd: deps.cwd,
    }),
    deps.runAndroidChecks
      ? checkAndroid({
          spawn: deps.spawn,
          androidHome: deps.androidHome,
          checkExists: deps.checkExists,
          envDir: deps.envDir,
          resolveAppiumBin: deps.resolveAppiumBin,
          requiredAvds: deps.requiredAvds,
        })
      : Promise.resolve<CheckResult[]>([]),
  ]);
  return [
    nodeVer,
    playwright,
    apiKey,
    apiUrl,
    npmRegistry,
    ...fileAssets,
    ...android,
  ];
}
