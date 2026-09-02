import { extname, relative, sep } from "node:path";

export const lintablePattern = "**/*.{ts,js}";

const lintableExtensions = new Set([".js", ".ts"]);

const generatedDirectoryNames = new Set([
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "out",
]);

export function selectLintableFiles(
  filePaths: readonly string[],
  cwd: string,
): readonly string[] {
  return filePaths.filter(
    (filePath) =>
      lintableExtensions.has(extname(filePath)) &&
      !isUnderGeneratedDirectory(filePath, cwd),
  );
}

function isUnderGeneratedDirectory(filePath: string, cwd: string): boolean {
  const withinProject = relative(cwd, filePath);
  return withinProject
    .split(sep)
    .slice(0, -1)
    .some((segment) => generatedDirectoryNames.has(segment));
}
