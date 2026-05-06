import { spawn } from "node:child_process";

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

export const defaultSpawn: SpawnFn = (cmd, args) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => resolve({ exitCode: -1, stdout, stderr }));
    child.on("close", (code) =>
      resolve({ exitCode: code ?? -1, stdout, stderr }),
    );
  });
