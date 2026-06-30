const extensionSwaps: Record<string, string> = {
  ".ts": ".js",
  ".js": ".ts",
  ".mts": ".mjs",
  ".mjs": ".mts",
  ".cts": ".cjs",
  ".cjs": ".cts",
};

/**
 * Maps a specifier's trailing source extension to its compiled sibling and
 * returns the rewritten specifier. Returns undefined when the specifier has no
 * known source extension, so bare specifiers and unknown extensions are never
 * touched.
 */
export function swapSourceExtension(specifier: string): string | undefined {
  const dotIndex = specifier.lastIndexOf(".");
  if (dotIndex === -1) return undefined;
  const ext = specifier.slice(dotIndex);
  const swapped = extensionSwaps[ext];
  if (swapped === undefined) return undefined;
  return specifier.slice(0, dotIndex) + swapped;
}
