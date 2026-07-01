import { join } from "node:path";

import { type Fs } from "~/shell/fs.js";

/**
 * Subpath-import aliases flow bundles use to reach pinned executor packages.
 * The platform drops these from the generated bundle package.json; each target
 * is a bare specifier that resolves through the inner-hop node_modules symlink
 * (see populateInnerHop) against exec/package.json. "#playwright" points at the
 * single browser driver the CLI pins (see pinnedPackages) and is the only alias
 * flows use today.
 */
const flowSubpathImports: Record<string, string> = {
  "#playwright": "playwright",
};

export type WriteExecSubpathImportsArgs = {
  execDir: string;
  fs: Fs;
};

/**
 * Merges the flow subpath-import aliases into exec/package.json so Node and the
 * flow bundler resolve "#playwright" against the inner-hop symlink. Preserves
 * all existing package.json fields and any pre-existing imports, with the flow
 * aliases winning on conflict, and tolerates a missing or invalid package.json.
 */
export async function writeExecSubpathImports(
  args: WriteExecSubpathImportsArgs,
): Promise<void> {
  const { execDir, fs } = args;
  const pkgPath = join(execDir, "package.json");

  const base = await readPackageJson(pkgPath, fs);
  const merged = {
    ...base,
    imports: { ...readExistingImports(base), ...flowSubpathImports },
  };
  await fs.writeFile(pkgPath, JSON.stringify(merged, undefined, 2));
}

async function readPackageJson(
  pkgPath: string,
  fs: Fs,
): Promise<Record<string, unknown>> {
  let content: string;
  try {
    content = await fs.readFile(pkgPath);
  } catch {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readExistingImports(
  base: Record<string, unknown>,
): Record<string, unknown> {
  const raw = base["imports"];
  if (typeof raw !== "object" || raw === null) return {};
  return raw as Record<string, unknown>;
}
