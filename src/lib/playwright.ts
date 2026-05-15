import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";

function deriveCliPath(pkgPath: string): string {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    bin?: string | Record<string, string>;
  };
  const binEntry =
    typeof pkg.bin === "string"
      ? pkg.bin
      : (pkg.bin?.["playwright"] ?? "cli.js");
  return join(dirname(pkgPath), binEntry);
}

function resolvePlaywrightCliFromPath(pathEnv: string): string | undefined {
  const binName = "playwright";
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    const binPath = join(dir, binName);
    if (!existsSync(binPath)) continue;
    let realPath: string;
    try {
      realPath = realpathSync(binPath);
    } catch {
      continue;
    }
    let current = dirname(realPath);
    while (true) {
      const pkgPath = join(current, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
          name?: string;
        };
        if (pkg.name === "playwright") return deriveCliPath(pkgPath);
      } catch {
        // not a valid package.json or not playwright — keep walking
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return undefined;
}

export function resolvePlaywrightCli(
  cwd = process.cwd(),
  pathEnv = process.env["PATH"] ?? "",
): string {
  // Try project-local install; Node resolution walks up from cwd for monorepos.
  try {
    const pkgPath = createRequire(join(cwd, "package.json")).resolve(
      "playwright/package.json",
    );
    return deriveCliPath(pkgPath);
  } catch {
    // local resolution failed — try PATH fallback
  }

  // Try global install via system PATH (npm global; bun global not supported).
  const fromPath = resolvePlaywrightCliFromPath(pathEnv);
  if (fromPath !== undefined) return fromPath;

  throw new Error(
    "Could not find Playwright. Install it in your project (`npm install playwright` or `bun add playwright`) or globally via npm (`npm install -g playwright`).",
  );
}
