import { pluralize } from "~/core/pluralize.js";

export const runnerMessages = {
  workersCapError: "--workers > 1 is deferred to v0.2; current cap is 1.",
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
  notSupportedInCli: (name: string) =>
    `${name} is not supported in the CLI runner`,
  notAvailableLocally: (name: string) =>
    `${name} is not available in local runs yet.`,
  noDefaultExport: (flowPath: string) =>
    `No default export found in "${flowPath}"`,
  retrying: (attempt: number, maxAttempts: number) =>
    `Retrying (${attempt} of ${maxAttempts})...`,
  screenshot: (path: string) => `Screenshot: ${path}`,
} as const;
