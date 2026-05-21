import { readFile, readdir } from "~/shell/fs.js";
import { join } from "node:path";
import { glob } from "tinyglobby";
import { extractFlowMeta, type PeekFlowMetaFn } from "~/core/flowMeta.js";

export const peekFlowMeta: PeekFlowMetaFn = async (filePath) => {
  const source = await readFile(filePath, "utf-8");
  return extractFlowMeta(source);
};

// Globs run from cwd *and* from each `.qawolf/<env>/` subdir so a
// freshly-pulled `.qawolf/<env>/src/flows/...` layout is discoverable
// alongside project-local flows. Duplicates are merged on absolute path.
async function resolveGlobRoots(cwd: string): Promise<string[]> {
  const qawolfPath = join(cwd, ".qawolf");
  let envDirs: string[] = [];
  try {
    const entries = await readdir(qawolfPath, { withFileTypes: true });
    envDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => join(qawolfPath, e.name));
  } catch {
    // .qawolf dir absent or unreadable
  }
  return [cwd, ...envDirs];
}

export async function expandPatterns(
  patterns: string[],
  cwd = process.cwd(),
): Promise<string[]> {
  const effectivePatterns =
    patterns.length > 0 ? patterns : ["**/*.flow.{ts,js}"];
  const roots = await resolveGlobRoots(cwd);
  const seen = new Set<string>();
  for (const root of roots) {
    const matches = await glob(effectivePatterns, {
      cwd: root,
      absolute: true,
    });
    for (const file of matches) seen.add(file);
  }
  return [...seen];
}
