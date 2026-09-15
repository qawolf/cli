import type ts from "typescript";

import { calledDeclaration } from "./callableResolution.js";
import { isProcessEnv, isReadAccess } from "./envReads.js";
import { stableParameterSlots } from "./stableParameters.js";
import { accessorDeclaration, constructedClass } from "./executionUnits.js";
import {
  functionExecution,
  isFunctionLike,
  walkExecuted,
  type FunctionLike,
} from "./executionSyntax.js";

/** Maps a function to every parameter it uses as an environment key. */
export type EnvAccessors = Map<ts.Node, Set<number>>;

type ForwardingCall = {
  caller: FunctionLike;
  argumentSlots: Map<number, number>;
};

export function findEnvAccessors(
  compiler: typeof ts,
  checker: ts.TypeChecker,
  sourceFiles: readonly ts.SourceFile[],
): EnvAccessors {
  const accessors: EnvAccessors = new Map();
  const callers = new Map<ts.Node, ForwardingCall[]>();
  const pending: { callee: ts.Node; keySlot: number }[] = [];
  const add = (fn: ts.Node, slot: number): void => {
    const slots = accessors.get(fn) ?? new Set<number>();
    if (slots.has(slot)) return;
    slots.add(slot);
    accessors.set(fn, slots);
    pending.push({ callee: fn, keySlot: slot });
  };
  const index = (fn: FunctionLike): void => {
    const parameters = stableParameterSlots(compiler, checker, fn);
    const parameterSlot = (node: ts.Node): number | undefined => {
      const symbol = compiler.isIdentifier(node)
        ? checker.getSymbolAtLocation(node)
        : undefined;
      return symbol === undefined ? undefined : parameters.get(symbol);
    };
    for (const root of functionExecution(fn)) {
      walkExecuted(compiler, root, (node) => {
        if (
          compiler.isElementAccessExpression(node) &&
          isProcessEnv(compiler, node.expression) &&
          isReadAccess(compiler, node)
        ) {
          const slot = parameterSlot(node.argumentExpression);
          if (slot !== undefined) add(fn, slot);
        }
        if (!compiler.isCallExpression(node) && !compiler.isNewExpression(node))
          return;
        const declaration =
          constructedClass(compiler, checker, node) ??
          calledDeclaration(compiler, checker, node);
        if (declaration === undefined) return;
        const callee = accessorDeclaration(compiler, checker, declaration);
        const argumentSlots = new Map<number, number>();
        node.arguments?.forEach((argument, argumentSlot) => {
          const slot = parameterSlot(argument);
          if (slot !== undefined) argumentSlots.set(argumentSlot, slot);
        });
        if (argumentSlots.size === 0) return;
        const entries = callers.get(callee) ?? [];
        entries.push({ caller: fn, argumentSlots });
        callers.set(callee, entries);
      });
    }
  };
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(compiler, node)) index(node);
    compiler.forEachChild(node, visit);
  };
  for (const source of sourceFiles) visit(source);

  // Each discovered accessor visits only callers that might forward its key.
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const entry = pending[cursor];
    if (entry === undefined) continue;
    const { callee, keySlot } = entry;
    for (const { caller, argumentSlots } of callers.get(callee) ?? []) {
      const slot = argumentSlots.get(keySlot);
      if (slot !== undefined) add(caller, slot);
    }
  }
  return accessors;
}
