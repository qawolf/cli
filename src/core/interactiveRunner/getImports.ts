import type ts from "typescript";

import type { TsconfigPaths } from "./tsconfigPaths.js";

export function getImports(options: {
  content: string;
  path: string;
  tsconfigPaths: TsconfigPaths | undefined;
  typescript: typeof ts;
}): string[] {
  const { typescript: compiler } = options;
  const sourceFile = compiler.createSourceFile(
    options.path,
    options.content,
    compiler.ScriptTarget.Latest,
    true,
  );

  const isLocal = (importPath: string) =>
    importPath.startsWith("./") ||
    importPath.startsWith("../") ||
    isPathAlias(importPath, options.tsconfigPaths);

  const found: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!compiler.isImportDeclaration(statement)) continue;
    const { moduleSpecifier } = statement;
    if (!compiler.isStringLiteral(moduleSpecifier)) continue;
    if (isLocal(moduleSpecifier.text)) found.push(moduleSpecifier.text);
  }

  const visit = (node: ts.Node): void => {
    if (isDynamicImportCall(node, compiler)) {
      const [argument] = node.arguments;
      if (
        argument !== undefined &&
        compiler.isStringLiteral(argument) &&
        isLocal(argument.text)
      ) {
        found.push(argument.text);
      }
    }
    compiler.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...new Set(found)];
}

function isDynamicImportCall(
  node: ts.Node,
  compiler: typeof ts,
): node is ts.CallExpression {
  return (
    compiler.isCallExpression(node) &&
    node.expression.kind === compiler.SyntaxKind.ImportKeyword
  );
}

/** A prefix match alone. The socket path collects a pattern naming no target. */
function isPathAlias(
  importPath: string,
  paths: TsconfigPaths | undefined,
): boolean {
  if (paths === undefined) return false;
  return Object.keys(paths).some((pattern) =>
    importPath.startsWith(pattern.replace("*", "")),
  );
}
