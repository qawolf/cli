const extensionSwaps: Record<string, string> = {
  ".ts": ".js",
  ".js": ".ts",
  ".mts": ".mjs",
  ".mjs": ".mts",
  ".cts": ".cjs",
  ".cjs": ".cts",
};

/**
 * Maps the trailing source extension of a local file specifier (relative,
 * absolute, or `file:` URL) to its sibling and returns the rewritten specifier.
 * Returns undefined for bare or package-subpath imports and unknown extensions,
 * so only sibling files are ever rewritten — never a dependency module.
 */
export function swapSourceExtension(specifier: string): string | undefined {
  const isLocalFileSpecifier =
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:");
  if (!isLocalFileSpecifier) return undefined;

  const dotIndex = specifier.lastIndexOf(".");
  if (dotIndex === -1) return undefined;
  const ext = specifier.slice(dotIndex);
  const swapped = extensionSwaps[ext];
  if (swapped === undefined) return undefined;
  return specifier.slice(0, dotIndex) + swapped;
}
