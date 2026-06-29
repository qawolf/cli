import envPaths from "env-paths";

/**
 * Directory `qawolf init` writes a catch-all `.gitignore` into, so anything
 * nested under it is excluded from version control by default.
 */
export const qawolfDir = ".qawolf";

/**
 * Default directory for `flows run` artifacts (videos, traces, HAR). Nested
 * under {@link qawolfDir} so the `.gitignore` written by `qawolf init` keeps
 * run artifacts out of version control.
 */
export const defaultOutputDir = `${qawolfDir}/output`;

let _paths: ReturnType<typeof envPaths> | undefined;

export function getConfigDir(): string {
  _paths ??= envPaths("qawolf");
  return _paths.config;
}

/**
 * Persistent platform data directory where the CLI installs its managed
 * runtime dependencies. Distinct from config (settings) and cache (ephemeral).
 */
export function getDataDir(): string {
  _paths ??= envPaths("qawolf");
  return _paths.data;
}
