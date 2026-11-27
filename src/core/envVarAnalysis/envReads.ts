import type ts from "typescript";

import type { EnvReads } from "./types.js";

export function isProcessEnv(compiler: typeof ts, node: ts.Node): boolean {
  return (
    compiler.isPropertyAccessExpression(node) &&
    node.name.text === "env" &&
    compiler.isIdentifier(node.expression) &&
    node.expression.text === "process"
  );
}

export function isReadAccess(compiler: typeof ts, node: ts.Node): boolean {
  let target = node;
  while (
    compiler.isParenthesizedExpression(target.parent) ||
    compiler.isAsExpression(target.parent) ||
    compiler.isNonNullExpression(target.parent) ||
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
    !compiler.isDeleteExpression(parent) &&
    !(
      compiler.isBinaryExpression(parent) &&
      parent.left === target &&
      parent.operatorToken.kind === compiler.SyntaxKind.EqualsToken
    ) &&
    !(
      (compiler.isForInStatement(parent) ||
        compiler.isForOfStatement(parent)) &&
      parent.initializer === target
    )
  );
}

/** Reads on one visited syntax node; execution scope is controlled by the caller. */
export function readEnvVarsFrom(
  compiler: typeof ts,
  node: ts.Node,
  isKeyParameter: (node: ts.Node) => boolean,
): EnvReads {
  const names = new Set<string>();
  let dynamic = false;
  if (
    compiler.isPropertyAccessExpression(node) &&
    isProcessEnv(compiler, node.expression) &&
    isReadAccess(compiler, node)
  ) {
    names.add(node.name.text);
  }
  if (
    compiler.isElementAccessExpression(node) &&
    isProcessEnv(compiler, node.expression) &&
    isReadAccess(compiler, node)
  ) {
    const argument = node.argumentExpression;
    if (compiler.isStringLiteralLike(argument)) {
      names.add(argument.text);
    } else if (!isKeyParameter(argument)) {
      dynamic = true;
    }
  }
  if (
    compiler.isVariableDeclaration(node) &&
    node.initializer !== undefined &&
    isProcessEnv(compiler, node.initializer) &&
    compiler.isObjectBindingPattern(node.name)
  ) {
    for (const element of node.name.elements) {
      if (element.dotDotDotToken !== undefined) {
        dynamic = true;
        continue;
      }
      const key = element.propertyName ?? element.name;
      if (compiler.isIdentifier(key) || compiler.isStringLiteralLike(key)) {
        names.add(key.text);
      } else if (
        compiler.isComputedPropertyName(key) &&
        compiler.isStringLiteralLike(key.expression)
      ) {
        names.add(key.expression.text);
      } else {
        dynamic = true;
      }
    }
  }
  if (isProcessEnv(compiler, node) && isReadAccess(compiler, node)) {
    const parent = node.parent;
    const handled =
      ((compiler.isPropertyAccessExpression(parent) ||
        compiler.isElementAccessExpression(parent)) &&
        parent.expression === node) ||
      (compiler.isVariableDeclaration(parent) &&
        parent.initializer === node &&
        compiler.isObjectBindingPattern(parent.name));
    if (!handled) dynamic = true;
  }
  return { names, dynamic };
}
