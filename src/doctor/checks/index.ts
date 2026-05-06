import type { CheckResult, SpawnFn } from "~/doctor/types.js";

import { checkApiKey } from "./apiKey.js";
import { checkApiUrl } from "./apiUrl.js";
import { checkNodeVersion } from "./nodeVersion.js";
import { checkNpmRegistry } from "./npmRegistry.js";
import { checkPlaywright } from "./playwright.js";

type CheckDeps = {
  readonly env: Record<string, string | undefined>;
  readonly fetch: typeof globalThis.fetch;
  readonly spawn: SpawnFn;
  readonly apiBaseUrl: string;
  readonly enginesNode: string;
  readonly processVersion: string;
};

export async function runChecks(deps: CheckDeps): Promise<CheckResult[]> {
  return Promise.all([
    checkNodeVersion({
      processVersion: deps.processVersion,
      enginesNode: deps.enginesNode,
    }),
    checkPlaywright({ spawn: deps.spawn }),
    checkApiKey({ env: deps.env }),
    checkApiUrl({ fetch: deps.fetch, apiBaseUrl: deps.apiBaseUrl }),
    checkNpmRegistry({ spawn: deps.spawn }),
  ]);
}

export const defaultSpawn: SpawnFn = async (cmd, args) => {
  try {
    const subprocess = Bun.spawn([cmd, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(subprocess.stdout).text(),
      new Response(subprocess.stderr).text(),
      subprocess.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch {
    return { exitCode: -1, stdout: "", stderr: "" };
  }
};
