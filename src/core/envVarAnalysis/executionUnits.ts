import type ts from "typescript";

import type { EnvAccessors } from "./accessors.js";
import { resolvedSymbol } from "./callableResolution.js";
import {
  functionExecution,
  isFunctionLike,
  isStatic,
} from "./executionSyntax.js";

export function executedOnCall(compiler: typeof ts, node: ts.Node): ts.Node[] {
  if (isFunctionLike(compiler, node)) return functionExecution(node);
  if (!compiler.isClassLike(node)) return [node];
  return node.members.flatMap((member) => {
    if (compiler.isConstructorDeclaration(member))
      return functionExecution(member);
    if (
      compiler.isPropertyDeclaration(member) &&
      !isStatic(compiler, member) &&
      member.initializer !== undefined
    ) {
      return [member.initializer];
    }
    return [];
  });
}

function classNamed(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.ClassLikeDeclaration | undefined {
  return resolvedSymbol(compiler, checker, expression)?.declarations?.find(
    (declaration) => compiler.isClassLike(declaration),
  );
}

function baseClassOf(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  cls: ts.ClassLikeDeclaration,
): ts.ClassLikeDeclaration | undefined {
  const extended = cls.heritageClauses?.find(
    (clause) => clause.token === compiler.SyntaxKind.ExtendsKeyword,
  )?.types[0];
  return extended === undefined
    ? undefined
    : classNamed(compiler, checker, extended.expression);
}

/** Synthetic constructor signatures can point at the base class or have no declaration. */
export function constructedClass(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  call: ts.CallExpression | ts.NewExpression,
): ts.ClassLikeDeclaration | undefined {
  if (compiler.isNewExpression(call))
    return classNamed(compiler, checker, call.expression);
  if (call.expression.kind !== compiler.SyntaxKind.SuperKeyword)
    return undefined;
  let current: ts.Node | undefined = call.parent;
  while (current !== undefined && !compiler.isClassLike(current))
    current = current.parent;
  return current === undefined
    ? undefined
    : baseClassOf(compiler, checker, current);
}

export function implicitBaseClass(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.ClassLikeDeclaration | undefined {
  if (!compiler.isClassLike(node)) return undefined;
  const hasConstructor = node.members.some(
    (member) =>
      compiler.isConstructorDeclaration(member) && member.body !== undefined,
  );
  return hasConstructor ? undefined : baseClassOf(compiler, checker, node);
}

export function accessorDeclaration(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  declaration: ts.Node,
): ts.Node {
  let current = declaration;
  const seen = new Set<ts.Node>();
  while (compiler.isClassLike(current) && !seen.has(current)) {
    seen.add(current);
    const constructor = current.members.find(
      (member) =>
        compiler.isConstructorDeclaration(member) && member.body !== undefined,
    );
    if (constructor !== undefined) return constructor;
    const base = baseClassOf(compiler, checker, current);
    if (base === undefined) break;
    current = base;
  }
  return current;
}

export function accessorKeyParameters(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  accessors: EnvAccessors,
  declaration: ts.Node,
): Set<ts.Symbol> {
  const fn = accessorDeclaration(compiler, checker, declaration);
  const parameters = new Set<ts.Symbol>();
  if (!isFunctionLike(compiler, fn)) return parameters;
  for (const slot of accessors.get(fn) ?? []) {
    const parameter = fn.parameters[slot];
    const symbol =
      parameter === undefined
        ? undefined
        : checker.getSymbolAtLocation(parameter.name);
    if (symbol !== undefined) parameters.add(symbol);
  }
  return parameters;
}
