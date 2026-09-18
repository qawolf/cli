import type ts from "typescript";

import { isFunctionLike, type FunctionLike } from "./executionSyntax.js";

export function resolvedSymbol(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined {
  const location =
    compiler.isElementAccessExpression(node) &&
    compiler.isStringLiteralLike(node.argumentExpression)
      ? node.argumentExpression
      : node;
  const symbol = checker.getSymbolAtLocation(location);
  return symbol !== undefined &&
    (symbol.flags & compiler.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

/** Resolves references and overload signatures to the declaration with an executable body. */
export function resolveCallable(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Node,
): FunctionLike | undefined {
  const seen = new Set<ts.Node>();
  const resolve = (current: ts.Node): FunctionLike | undefined => {
    if (seen.has(current)) return undefined;
    seen.add(current);
    if (isFunctionLike(compiler, current) && current.body !== undefined)
      return current;
    if (
      compiler.isParenthesizedExpression(current) ||
      compiler.isAsExpression(current) ||
      compiler.isTypeAssertionExpression(current) ||
      compiler.isNonNullExpression(current) ||
      compiler.isSatisfiesExpression(current) ||
      compiler.isExportAssignment(current)
    ) {
      return resolve(current.expression);
    }
    if (
      (compiler.isVariableDeclaration(current) ||
        compiler.isPropertyDeclaration(current) ||
        compiler.isPropertyAssignment(current)) &&
      current.initializer !== undefined
    ) {
      return resolve(current.initializer);
    }
    if (compiler.isShorthandPropertyAssignment(current)) {
      for (const declaration of checker.getShorthandAssignmentValueSymbol(
        current,
      )?.declarations ?? []) {
        const callable = resolve(declaration);
        if (callable !== undefined) return callable;
      }
    }
    const name = isFunctionLike(compiler, current) ? current.name : current;
    const symbol =
      name === undefined ? undefined : resolvedSymbol(compiler, checker, name);
    for (const declaration of symbol?.declarations ?? []) {
      const callable = resolve(declaration);
      if (callable !== undefined) return callable;
    }
    return undefined;
  };
  return resolve(node);
}

export function calledDeclaration(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  call: ts.CallExpression | ts.NewExpression,
): ts.Node | undefined {
  const signature = checker.getResolvedSignature(call)?.declaration;
  const direct = resolveCallable(compiler, checker, call.expression);
  if (direct !== undefined && !compiler.isGetAccessorDeclaration(direct))
    return direct;
  return signature === undefined
    ? undefined
    : (resolveCallable(compiler, checker, signature) ?? signature);
}

export function defaultEntrypoint(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  source: ts.SourceFile,
): FunctionLike | undefined {
  const module = checker.getSymbolAtLocation(source);
  const exported =
    module === undefined
      ? undefined
      : checker
          .getExportsOfModule(module)
          .find((symbol) => symbol.name === "default");
  const symbol =
    exported !== undefined &&
    (exported.flags & compiler.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(exported)
      : exported;
  for (const declaration of symbol?.declarations ?? []) {
    const callable = resolveCallable(compiler, checker, declaration);
    if (callable !== undefined) return callable;
  }
  if (symbol === undefined) return undefined;
  const definition = checker.getTypeOfSymbolAtLocation(symbol, source);
  const run = checker.getPropertyOfType(definition, "run");
  for (const declaration of run?.declarations ?? []) {
    const callable = resolveCallable(compiler, checker, declaration);
    if (callable !== undefined) return callable;
  }
  return undefined;
}
