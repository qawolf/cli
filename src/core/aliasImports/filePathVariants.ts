const sourceExtensionPattern = /\.(js|ts)$/;
const sourceExtensions = [".js", ".ts"];

export function filePathVariants(importPath: string): string[] {
  const hasSourceExtension = sourceExtensionPattern.test(importPath);
  const base = importPath.replace(sourceExtensionPattern, "");

  const siblings = sourceExtensions.map((extension) => base + extension);
  const indexes = hasSourceExtension
    ? []
    : sourceExtensions.map((extension) => `${base}/index${extension}`);

  return [...new Set([importPath, ...siblings, ...indexes])];
}
