import type ts from "typescript";

export type AliasSpecifier = {
  end: number;
  specifier: string;
  start: number;
};

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

export function collectAliasSpecifiers(options: {
  sourceFile: ts.SourceFile;
  typescript: typeof ts;
}): AliasSpecifier[] {
  const { sourceFile, typescript: compiler } = options;
  const specifiers: AliasSpecifier[] = [];

  const addCandidate = (literal: ts.StringLiteralLike): void => {
    if (isRelativeSpecifier(literal.text)) return;
    specifiers.push({
      end: literal.getEnd(),
      specifier: literal.text,
      start: literal.getStart(sourceFile),
    });
  };

  for (const statement of sourceFile.statements) {
    if (compiler.isImportDeclaration(statement)) {
      const phase = statement.importClause?.phaseModifier;
      if (phase === compiler.SyntaxKind.TypeKeyword) continue;
      if (compiler.isStringLiteral(statement.moduleSpecifier)) {
        addCandidate(statement.moduleSpecifier);
      }
      continue;
    }

    if (compiler.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const { moduleSpecifier } = statement;
      if (
        moduleSpecifier !== undefined &&
        compiler.isStringLiteral(moduleSpecifier)
      ) {
        addCandidate(moduleSpecifier);
      }
    }
  }

  const visit = (node: ts.Node): void => {
    if (
      compiler.isCallExpression(node) &&
      node.expression.kind === compiler.SyntaxKind.ImportKeyword
    ) {
      const [firstArgument] = node.arguments;
      if (
        firstArgument !== undefined &&
        (compiler.isStringLiteral(firstArgument) ||
          compiler.isNoSubstitutionTemplateLiteral(firstArgument))
      ) {
        addCandidate(firstArgument);
      }
      return;
    }
    compiler.forEachChild(node, visit);
  };
  visit(sourceFile);

  return specifiers;
}
