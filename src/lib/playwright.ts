import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export function resolvePlaywrightCli(): string {
  try {
    const require_ = createRequire(import.meta.url);
    const pkgPath = require_.resolve("playwright/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      bin?: string | Record<string, string>;
    };
    const binEntry =
      typeof pkg.bin === "string"
        ? pkg.bin
        : (pkg.bin?.["playwright"] ?? "cli.js");
    return join(dirname(pkgPath), binEntry);
  } catch (err) {
    throw new Error(
      "Could not find Playwright. It should ship with the qawolf CLI — try reinstalling the CLI.",
      { cause: err },
    );
  }
}
