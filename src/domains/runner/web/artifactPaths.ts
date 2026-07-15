import path from "node:path";
import type { ContextSetupOptions } from "./types.js";

/** Returns `basePath` for index 0; inserts `-<n>` before the extension after. */
function indexedArtifactPath(basePath: string, index: number): string {
  if (index === 0) return basePath;
  const ext = path.extname(basePath);
  const base = path.basename(basePath, ext);
  return path.join(path.dirname(basePath), `${base}-${index + 1}${ext}`);
}

export type ArtifactPaths = { harPaths: string[]; tracePaths: string[] };

/**
 * Assigns each browser context its setup and distinct HAR/trace artifact
 * paths, and reports every path handed out.
 */
export function createContextArtifacts(
  contextSetup: ContextSetupOptions,
  tracePath: string | undefined,
): {
  nextSetup: () => { setup: ContextSetupOptions; index: number };
  nextTracePath: (index: number) => string | undefined;
  artifactPaths: () => ArtifactPaths;
} {
  let contextIndex = 0;
  const harPaths: string[] = [];
  const tracePaths: string[] = [];

  const nextSetup = () => {
    const index = contextIndex;
    contextIndex += 1;
    const setup = { ...contextSetup };
    if (contextSetup.recordHar !== undefined) {
      const harPath = indexedArtifactPath(contextSetup.recordHar.path, index);
      harPaths.push(harPath);
      setup.recordHar = { ...contextSetup.recordHar, path: harPath };
    }
    return { setup, index };
  };

  const nextTracePath = (index: number): string | undefined => {
    if (tracePath === undefined) return undefined;
    const contextTracePath = indexedArtifactPath(tracePath, index);
    tracePaths.push(contextTracePath);
    return contextTracePath;
  };

  const artifactPaths = (): ArtifactPaths => ({
    harPaths: [...harPaths],
    tracePaths: [...tracePaths],
  });

  return { nextSetup, nextTracePath, artifactPaths };
}
