import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pinnedPackages } from "./pinnedPackages.js";

/**
 * Scaffolds a fake managed runtime under `<depsRoot>/node_modules` with a stub
 * package.json for each pinned package, so tests can exercise the inner-hop /
 * deps-resolution code paths without a real npm install.
 */
export async function scaffoldManagedRuntime(depsRoot: string): Promise<void> {
  const nm = join(depsRoot, "node_modules");
  for (const { name } of pinnedPackages) {
    const pkgDir = join(nm, ...name.split("/"));
    await mkdir(pkgDir, { recursive: true });
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify({ name, version: "0.0.0" }),
    );
  }
}
