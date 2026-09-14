import type ts from "typescript";

import {
  calledDeclaration,
  resolveCallable,
  resolvedSymbol,
} from "./callableResolution.js";
import { isReadAccess, readEnvVarsFrom } from "./envReads.js";
import {
  constructedClass,
  executedOnCall,
  implicitBaseClass,
} from "./executionUnits.js";
import { isFunctionLike, walkExecuted } from "./executionSyntax.js";
import { importedModule } from "./moduleExecution.js";
import type { EnvReads } from "./types.js";

export type WalkArgs = {
  readonly compiler: typeof ts;
  readonly checker: ts.TypeChecker;
  readonly isLocalFile: (fileName: string) => boolean;
};

export type ExecutionSummary = {
  reads: EnvReads;
  callees: Set<ts.Node>;
};

export function summarizeExecution(
  args: WalkArgs,
  declaration: ts.Node,
): ExecutionSummary {
  const { compiler, checker, isLocalFile } = args;
  const reads: EnvReads = { names: new Set(), dynamic: false };
  const callees = new Set<ts.Node>();
  const include = (callee: ts.Node | undefined): void => {
    if (callee !== undefined && isLocalFile(callee.getSourceFile().fileName))
      callees.add(callee);
  };
  const isLocalReference = (node: ts.Node): boolean => {
    const local =
      resolvedSymbol(compiler, checker, node)?.declarations?.some((item) =>
        isLocalFile(item.getSourceFile().fileName),
      ) ?? false;
    return (
      local ||
      ((compiler.isPropertyAccessExpression(node) ||
        compiler.isElementAccessExpression(node)) &&
        isLocalReference(node.expression))
    );
  };
  const visitCall = (call: ts.CallExpression | ts.NewExpression): void => {
    if (call.expression.kind === compiler.SyntaxKind.ImportKeyword) {
      const specifier = call.arguments?.[0];
      if (specifier === undefined || !compiler.isStringLiteralLike(specifier))
        reads.dynamic = true;
      return;
    }
    const callee =
      constructedClass(compiler, checker, call) ??
      calledDeclaration(compiler, checker, call);
    include(callee);
    if (
      callee !== undefined &&
      isLocalFile(callee.getSourceFile().fileName) &&
      !compiler.isClassLike(callee) &&
      (!isFunctionLike(compiler, callee) || callee.body === undefined)
    ) {
      reads.dynamic = true;
    } else if (callee === undefined && isLocalReference(call.expression)) {
      reads.dynamic = true;
    }
    // A callback handed to a call can execute even when the callee is an external API.
    for (const argument of call.arguments ?? []) {
      const callback = resolveCallable(compiler, checker, argument);
      if (callback === undefined) continue;
      include(callback);
    }
  };
  const visit = (node: ts.Node): void => {
    const direct = readEnvVarsFrom(compiler, node);
    for (const name of direct.names) reads.names.add(name);
    reads.dynamic ||= direct.dynamic;
    include(importedModule(compiler, checker, node));
    if (compiler.isCallExpression(node) || compiler.isNewExpression(node))
      visitCall(node);
    if (
      (compiler.isPropertyAccessExpression(node) ||
        compiler.isElementAccessExpression(node)) &&
      isReadAccess(compiler, node)
    ) {
      for (const member of resolvedSymbol(compiler, checker, node)
        ?.declarations ?? []) {
        if (compiler.isGetAccessorDeclaration(member)) include(member);
      }
    }
  };
  for (const root of executedOnCall(compiler, declaration))
    walkExecuted(compiler, root, visit);
  include(implicitBaseClass(compiler, checker, declaration));
  if (!compiler.isSourceFile(declaration)) include(declaration.getSourceFile());
  return { reads, callees };
}
