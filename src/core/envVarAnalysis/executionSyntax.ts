import type ts from "typescript";

export type FunctionLike =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

export function isFunctionLike(
  compiler: typeof ts,
  node: ts.Node,
): node is FunctionLike {
  return (
    compiler.isFunctionDeclaration(node) ||
    compiler.isMethodDeclaration(node) ||
    compiler.isArrowFunction(node) ||
    compiler.isFunctionExpression(node) ||
    compiler.isConstructorDeclaration(node) ||
    compiler.isGetAccessorDeclaration(node) ||
    compiler.isSetAccessorDeclaration(node)
  );
}

export function isStatic(compiler: typeof ts, node: ts.ClassElement): boolean {
  return (
    compiler.canHaveModifiers(node) &&
    (compiler
      .getModifiers(node)
      ?.some(
        (modifier) => modifier.kind === compiler.SyntaxKind.StaticKeyword,
      ) ??
      false)
  );
}

/** Walks evaluation of an expression or statement, leaving function bodies to call edges. */
export function walkExecuted(
  compiler: typeof ts,
  node: ts.Node,
  visitor: (node: ts.Node) => void,
): void {
  const visit = (current: ts.Node): void => {
    if (compiler.isTypeNode(current) || isFunctionLike(compiler, current))
      return;
    if (compiler.isClassLike(current)) {
      for (const decorated of [current, ...current.members]) {
        const decorators = compiler.canHaveDecorators(decorated)
          ? compiler.getDecorators(decorated)
          : undefined;
        for (const decorator of decorators ?? []) visit(decorator.expression);
      }
      for (const clause of current.heritageClauses ?? []) {
        if (clause.token === compiler.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) visit(type.expression);
        }
      }
      for (const member of current.members) {
        if (
          member.name !== undefined &&
          compiler.isComputedPropertyName(member.name)
        ) {
          visit(member.name.expression);
        }
        if (
          compiler.isPropertyDeclaration(member) &&
          isStatic(compiler, member) &&
          member.initializer !== undefined
        ) {
          visit(member.initializer);
        }
        if (compiler.isClassStaticBlockDeclaration(member)) visit(member.body);
      }
      return;
    }
    visitor(current);
    compiler.forEachChild(current, visit);
  };
  visit(node);
}

export function functionExecution(fn: FunctionLike): ts.Node[] {
  return [...fn.parameters, ...(fn.body === undefined ? [] : [fn.body])];
}
