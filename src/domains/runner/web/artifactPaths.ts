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
 * Assigns each browser context its setup (merged with caller overrides,
 * caller wins) and distinct HAR/trace artifact paths, and reports every
 * effective path handed out.
 */
export function createContextArtifacts(
  contextSetup: ContextSetupOptions,
  tracePath: string | undefined,
): {
  nextSetup: (overrides?: ContextSetupOptions) => {
    setup: ContextSetupOptions;
    index: number;
  };
  nextTracePath: (index: number) => string | undefined;
  artifactPaths: () => ArtifactPaths;
} {
  let contextIndex = 0;
  const harPaths: string[] = [];
  const tracePaths: string[] = [];

  const nextSetup = (overrides: ContextSetupOptions = {}) => {
    const index = contextIndex;
    contextIndex += 1;
    const setup = { ...contextSetup, ...overrides };
    if (
      contextSetup.recordHar !== undefined &&
      overrides.recordHar === undefined
    ) {
      setup.recordHar = {
        ...contextSetup.recordHar,
        path: indexedArtifactPath(contextSetup.recordHar.path, index),
      };
    }
    // Record the path Playwright will actually write to — a caller-provided
    // recordHar replaces the generated one, and cleanup must target it.
    if (setup.recordHar !== undefined) harPaths.push(setup.recordHar.path);
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
