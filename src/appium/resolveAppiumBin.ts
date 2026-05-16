import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export function resolveAppiumBin(): string {
  try {
    const pkgPath = createRequire(import.meta.url).resolve(
      "appium/package.json",
    );
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      bin?: string | Record<string, string>;
    };
    const binEntry =
      typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.["appium"];
    if (!binEntry) {
      throw new Error("Appium binary entry missing from package.json");
    }
    return join(dirname(pkgPath), binEntry);
  } catch (err) {
    throw new Error(
      "Appium not found in node_modules. Install it with your package manager (e.g. npm install appium).",
      { cause: err },
    );
  }
}
