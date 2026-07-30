import { pluralize } from "~/core/pluralize.js";

import { packageLoadFailed } from "./toolNotFound.js";

export const runnerMessages = {
  playwrightLoadFailed: (envDir: string, detail: string) =>
    packageLoadFailed("Playwright", envDir, detail),
  androidWorkersUnsupported:
    "Android flows are not yet supported with --workers > 1; rerun Android flows with --workers 1.",
  noFlowsMatched: "No flows matched.",
  androidBootFailed: "Android boot failed",
  preparingEnvironment: "Preparing environment",
  environmentReady: "Environment ready",
  unrecognizedTarget: (target: string) =>
    `Unrecognized flow target: "${target}"`,
  flowsSkipped: (type: string, count: number) =>
    `${pluralize(count, `${type} flow`)} skipped`,
  flowsFailed: (count: number) => `${count} flow(s) failed`,
  invalidRetries: (retries: unknown) =>
    `retries must be a non-negative integer, got ${String(retries)}`,
  manifestStampReadFailed: (file: string, message: string) =>
    `failed to read manifest stamp for ${file}: ${message}`,
  harCleanupFailed: (file: string, message: string) =>
    `failed to delete HAR file ${file} (retain-on-failure); remove it manually: ${message}`,
  traceCleanupFailed: (file: string, message: string) =>
    `failed to delete trace file ${file} (retain-on-failure); remove it manually: ${message}`,
  notSupportedInCli: (name: string) =>
    `${name} is not supported in the CLI runner`,
  notAvailableLocally: (name: string) =>
    `${name} is not available in local runs yet.`,
  noDefaultExport: (flowPath: string) =>
    `No default export found in "${flowPath}"`,
  retrying: (attempt: number, maxAttempts: number) =>
    `Retrying (${attempt} of ${maxAttempts})...`,
  screenshot: (path: string) => `Screenshot: ${path}`,
  managedRuntimeNote: (dir: string) =>
    `Using managed runtime — override with --deps <dir> or QAWOLF_RUNTIME_DIR:\n${dir}`,
  installingProjectDeps: (count: number) =>
    `Installing ${pluralize(count, "project dependency", "project dependencies")}…`,
  outerHopCandidateRejected: (dir: string, missing: string[]) =>
    `outer-hop candidate rejected: ${dir} missing ${missing.join(", ")}`,
  moduleNotFoundHint: (pkg: string, projectDir: string | undefined) =>
    projectDir === undefined
      ? `Hint: '${pkg}' could not be resolved. Run from within your flows project so its dependencies can be found.`
      : `Hint: '${pkg}' could not be resolved. Ensure it is declared in ${projectDir}/package.json "dependencies" and run npm install in that project.`,
} as const;
