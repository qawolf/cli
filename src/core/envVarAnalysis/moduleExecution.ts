import type ts from "typescript";

import { resolvedSymbol } from "./callableResolution.js";

/** An explicit type-only import/export is erased and does not initialize its module. */
export function importedModule(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.SourceFile | undefined {
  let specifier: ts.Expression | undefined;
  if (compiler.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (clause?.phaseModifier === compiler.SyntaxKind.TypeKeyword)
      return undefined;
    const bindings = clause?.namedBindings;
    if (
      clause?.name === undefined &&
      bindings !== undefined &&
      compiler.isNamedImports(bindings) &&
      bindings.elements.length > 0 &&
      bindings.elements.every((element) => {
        if (element.isTypeOnly) return true;
        const symbol = resolvedSymbol(compiler, checker, element.name);
        return (
          symbol !== undefined &&
          (symbol.flags & compiler.SymbolFlags.Value) === 0
        );
      })
    )
      return undefined;
    specifier = node.moduleSpecifier;
  } else if (compiler.isExportDeclaration(node)) {
    if (node.isTypeOnly) return undefined;
    const clause = node.exportClause;
    if (
      clause !== undefined &&
      compiler.isNamedExports(clause) &&
      clause.elements.length > 0 &&
      clause.elements.every((element) => element.isTypeOnly)
    )
      return undefined;
    specifier = node.moduleSpecifier;
  } else if (
    compiler.isCallExpression(node) &&
    node.expression.kind === compiler.SyntaxKind.ImportKeyword
  ) {
    specifier = node.arguments[0];
  }
  if (specifier === undefined || !compiler.isStringLiteralLike(specifier))
    return undefined;
  return checker
    .getSymbolAtLocation(specifier)
    ?.declarations?.find((declaration) => compiler.isSourceFile(declaration));
}
