import type ts from "typescript";

import type { FunctionLike } from "./executionSyntax.js";

function isWrite(compiler: typeof ts, node: ts.Node): boolean {
  let target = node;
  while (
    compiler.isParenthesizedExpression(target.parent) ||
    compiler.isAsExpression(target.parent) ||
    compiler.isTypeAssertionExpression(target.parent) ||
    compiler.isNonNullExpression(target.parent) ||
    compiler.isSatisfiesExpression(target.parent) ||
    compiler.isShorthandPropertyAssignment(target.parent) ||
    (compiler.isPropertyAssignment(target.parent) &&
      target.parent.initializer === target) ||
    compiler.isObjectLiteralExpression(target.parent) ||
    compiler.isArrayLiteralExpression(target.parent) ||
    compiler.isSpreadAssignment(target.parent) ||
    compiler.isSpreadElement(target.parent)
  ) {
    target = target.parent;
  }
  const parent = target.parent;
  return (
    (compiler.isBinaryExpression(parent) &&
      parent.left === target &&
      parent.operatorToken.kind >= compiler.SyntaxKind.FirstAssignment &&
      parent.operatorToken.kind <= compiler.SyntaxKind.LastAssignment) ||
    ((compiler.isForInStatement(parent) || compiler.isForOfStatement(parent)) &&
      parent.initializer === target) ||
    compiler.isPostfixUnaryExpression(parent) ||
    (compiler.isPrefixUnaryExpression(parent) &&
      (parent.operator === compiler.SyntaxKind.PlusPlusToken ||
        parent.operator === compiler.SyntaxKind.MinusMinusToken))
  );
}

/** Parameter slots whose original arguments are not invalidated by writes. */
export function stableParameterSlots(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  fn: FunctionLike,
): Map<ts.Symbol, number> {
  const parameters = new Map<ts.Symbol, number>();
  fn.parameters.forEach((parameter, slot) => {
    const symbol = checker.getSymbolAtLocation(parameter.name);
    if (symbol !== undefined) parameters.set(symbol, slot);
  });
  const visit = (node: ts.Node): void => {
    if (compiler.isIdentifier(node) && isWrite(compiler, node)) {
      const symbol = compiler.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
      if (symbol !== undefined) parameters.delete(symbol);
    }
    compiler.forEachChild(node, visit);
  };
  visit(fn);
  return parameters;
}
