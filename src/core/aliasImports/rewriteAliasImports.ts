import { posix } from "node:path";
import type ts from "typescript";

import { collectAliasSpecifiers } from "./collectAliasSpecifiers.js";
import { filePathVariants } from "./filePathVariants.js";
import { resolvePathAlias, type TsconfigPaths } from "./tsconfigPaths.js";

type SpecifierEdit = { end: number; relativeSpecifier: string; start: number };

function findTargetFilePath(options: {
  aliasTarget: string;
  projectFilePaths: ReadonlySet<string>;
}): string | undefined {
  return filePathVariants(posix.normalize(options.aliasTarget)).find(
    (candidate) => options.projectFilePaths.has(candidate),
  );
}

function toRelativeSpecifier(options: {
  importingFilePath: string;
  targetFilePath: string;
}): string {
  const relativePath = posix.relative(
    posix.dirname(options.importingFilePath),
    options.targetFilePath,
  );
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function applyEdit(code: string, edit: SpecifierEdit): string {
  const quote = code.slice(edit.start, edit.start + 1);
  return (
    code.slice(0, edit.start) +
    quote +
    edit.relativeSpecifier +
    quote +
    code.slice(edit.end)
  );
}

export function rewriteAliasImports(options: {
  code: string;
  importingFilePath: string;
  projectFilePaths: ReadonlySet<string>;
  tsconfigPaths: TsconfigPaths | undefined;
  typescript: typeof ts;
}): string {
  const { code, importingFilePath, projectFilePaths, tsconfigPaths } = options;
  const compiler = options.typescript;
  if (tsconfigPaths === undefined) return code;

  const sourceFile = compiler.createSourceFile(
    importingFilePath,
    code,
    compiler.ScriptTarget.Latest,
    true,
  );

  const edits = collectAliasSpecifiers({
    sourceFile,
    typescript: compiler,
  }).flatMap<SpecifierEdit>((candidate) => {
    const aliasTarget = resolvePathAlias(candidate.specifier, tsconfigPaths);
    if (aliasTarget === undefined) return [];

    const targetFilePath = findTargetFilePath({
      aliasTarget,
      projectFilePaths,
    });
    if (targetFilePath === undefined) return [];

    return [
      {
        end: candidate.end,
        relativeSpecifier: toRelativeSpecifier({
          importingFilePath,
          targetFilePath,
        }),
        start: candidate.start,
      },
    ];
  });

  return edits
    .sort((left, right) => right.start - left.start)
    .reduce(applyEdit, code);
}
