import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { getDataDir } from "~/core/paths.js";

/**
 * The compiled binary entry (generated at build time, see scripts/buildBinary.ts)
 * embeds cli.js as a file asset and exports its on-disk path through this env
 * var before delegating to main. Unset in node/bun runs, where the worker
 * executes the entry script directly.
 */
const embeddedCliPathEnv = "QAWOLF_EMBEDDED_CLI_PATH";

/**
 * Extracts the embedded cli.js bundle to a real on-disk file so a BUN_BE_BUN
 * worker subprocess can execute it — a fresh subprocess cannot mount the
 * binary's embedded `/$bunfs` filesystem. Returns the on-disk path, or
 * undefined when nothing is embedded (non-compiled runs). The asset basename
 * carries a content hash, so the extracted file is stable per binary build and
 * safely reused across invocations.
 */
export function extractEmbeddedWorkerCli(): string | undefined {
  const assetPath = process.env[embeddedCliPathEnv];
  if (assetPath === undefined || assetPath === "") return undefined;
  const dir = join(getDataDir(), "worker");
  const dest = join(dir, basename(assetPath));
  if (existsSync(dest)) return dest;
  mkdirSync(dir, { recursive: true });
  writeFileSync(dest, readFileSync(assetPath));
  return dest;
}
