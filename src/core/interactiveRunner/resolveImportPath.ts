// Posix, not the platform's separator. Collected paths always use forward
// slashes, so resolving with backslashes on Windows would match nothing.
import { dirname, join, normalize } from "node:path/posix";

import { resolvePathAlias, type TsconfigPaths } from "./tsconfigPaths.js";

/** So `.tsx`, `.json`, `.mjs` and `.cjs` imports are unreachable. */
const supportedExtensions = [".ts", ".js"];

export type ResolvedImportPath =
  | { type: "resolved"; path: string }
  | { type: "not-a-repository-import" }
  | { type: "unresolved-repository-import" };

/** Tries the other extension too, since `./page.js` may be `./page.ts` on disk. */
function candidatesForExplicitExtension(options: {
  importPath: string;
  resolvedPath: string;
}): string[] {
  const matching = supportedExtensions.find((extension) =>
    options.importPath.endsWith(extension),
  );
  if (matching === undefined) return [options.resolvedPath];

  const withoutExtension = options.resolvedPath.slice(0, -matching.length);
  return [
    options.resolvedPath,
    ...supportedExtensions
      .filter((extension) => extension !== matching)
      .map((extension) => `${withoutExtension}${extension}`),
  ];
}

/**
 * An alias target roots at the project, a relative import at the importing
 * file's directory. Conflating those two is the easiest way to get this wrong.
 */
export function resolveImportPath(options: {
  importPath: string;
  importingFilePath: string;
  repositoryFilePaths: ReadonlySet<string>;
  tsconfigPaths: TsconfigPaths | undefined;
}): ResolvedImportPath {
  const aliasTarget = resolvePathAlias(
    options.importPath,
    options.tsconfigPaths,
  );
  const resolvedPath =
    aliasTarget === undefined
      ? normalize(join(dirname(options.importingFilePath), options.importPath))
      : normalize(aliasTarget);

  const hasExplicitExtension = supportedExtensions.some((extension) =>
    options.importPath.endsWith(extension),
  );
  // No bare path, so a directory resolves through its index rather than itself.
  const candidates = hasExplicitExtension
    ? candidatesForExplicitExtension({
        importPath: options.importPath,
        resolvedPath,
      })
    : [
        `${resolvedPath}.ts`,
        `${resolvedPath}.js`,
        `${resolvedPath}/index.ts`,
        `${resolvedPath}/index.js`,
      ];

  for (const candidate of candidates) {
    if (options.repositoryFilePaths.has(candidate)) {
      return { path: candidate, type: "resolved" };
    }
  }

  const isRepositoryImport =
    aliasTarget !== undefined ||
    options.importPath.startsWith("./") ||
    options.importPath.startsWith("../");

  return isRepositoryImport
    ? { type: "unresolved-repository-import" }
    : { type: "not-a-repository-import" };
}
