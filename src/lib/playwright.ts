import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";

function resolveLocalBinWrapper(cwd: string): string | undefined {
  try {
    const pkgPath = createRequire(join(cwd, "package.json")).resolve(
      "playwright/package.json",
    );
    // node_modules/.bin/playwright lives two levels up from playwright/package.json
    const binWrapper = join(dirname(dirname(pkgPath)), ".bin", "playwright");
    return existsSync(binWrapper) ? binWrapper : undefined;
  } catch {
    return undefined;
  }
}

function resolvePathBin(pathEnv: string): string | undefined {
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    const bin = join(dir, "playwright");
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

export function resolvePlaywrightCli(
  cwd = process.cwd(),
  pathEnv = process.env["PATH"] ?? "",
): string {
  // Try project-local install; Node resolution walks up from cwd for monorepos.
  const local = resolveLocalBinWrapper(cwd);
  if (local !== undefined) return local;

  // Try global install via system PATH.
  const fromPath = resolvePathBin(pathEnv);
  if (fromPath !== undefined) return fromPath;

  throw new Error(
    "Could not find Playwright. Install it in your project (`npm install playwright` or `bun add playwright`) or globally via npm (`npm install -g playwright`).",
  );
}
