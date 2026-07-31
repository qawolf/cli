import type { Fs } from "~/shell/fs.js";
import { join, resolve } from "node:path";
import { glob } from "tinyglobby";
import { extractFlowMeta, type PeekFlowMetaFn } from "~/core/flowMeta.js";
import type { Logger } from "~/shell/logger.js";

export function makePeekFlowMeta(fs: Fs): PeekFlowMetaFn {
  return async (filePath) => {
    const source = await fs.readFile(filePath);
    return extractFlowMeta(source);
  };
}

// Globs run from cwd *and* from each `.qawolf/<env>/` subdir so a
// freshly-pulled `.qawolf/<env>/src/flows/...` layout is discoverable
// alongside project-local flows. Duplicates are merged on absolute path.
async function resolveGlobRoots(cwd: string, fs: Fs): Promise<string[]> {
  const qawolfPath = join(cwd, ".qawolf");
  let envDirs: string[] = [];
  try {
    const entries = await fs.readdirWithTypes(qawolfPath);
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
  cwd: string,
  logger: Logger | undefined,
  fs: Fs,
): Promise<string[]> {
  logger?.debug(`expandPatterns: ${patterns.join(", ")}`);
  const effectivePatterns =
    patterns.length > 0 ? patterns : ["**/*.flow.{ts,js}"];
  const roots = await resolveGlobRoots(cwd, fs);
  const seen = new Set<string>();
  for (const root of roots) {
    const matches = await glob(effectivePatterns, {
      cwd: root,
      absolute: true,
    });
    for (const match of matches) {
      // tinyglobby emits forward slashes even on win32; the rest of the CLI
      // builds paths with node:path. stageFlowFiles' remapPath compares the
      // two forms, so canonicalize here.
      const file = resolve(match);
      seen.add(file);
      logger?.trace(`found: ${file}`);
    }
  }
  logger?.debug(`expandPatterns: ${seen.size} files matched`);
  return [...seen];
}
