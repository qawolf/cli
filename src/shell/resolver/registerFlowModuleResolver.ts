import nodeModule from "node:module";

import { swapSourceExtension } from "./swapSourceExtension.js";

// Minimal local types for the Node.js synchronous resolve hook API (v22.15+); context is passed through opaquely.
type ResolveContext = {
  readonly conditions: readonly string[];
  readonly importAttributes: Record<string, string | undefined>;
  readonly parentURL: string | undefined;
};

type ResolveFnOutput = {
  url: string;
  shortCircuit?: boolean;
  format?: string | null;
};

type NextResolve = (
  specifier: string,
  context?: Partial<ResolveContext>,
) => ResolveFnOutput;

/** The synchronous Node.js ESM resolve hook signature. */
export type FlowResolveHook = (
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
) => ResolveFnOutput;

type NodeModuleWithHooks = {
  registerHooks: (options: { resolve?: FlowResolveHook }) => void;
};

let registered = false;

function isModuleNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as Record<string, unknown>)["code"] === "ERR_MODULE_NOT_FOUND"
  );
}

/**
 * Synchronous ESM resolve hook that retries the sibling source extension when a
 * specifier fails with ERR_MODULE_NOT_FOUND. See registerFlowModuleResolver for why.
 */
export function flowResolveHook(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): ResolveFnOutput {
  try {
    return nextResolve(specifier, context);
  } catch (err) {
    if (!isModuleNotFound(err)) throw err;
    const swapped = swapSourceExtension(specifier);
    if (swapped === undefined) throw err;
    try {
      return nextResolve(swapped, context);
    } catch {
      throw err;
    }
  }
}

/**
 * Resolves the `registerHooks` static from a `node:module` value, or undefined
 * when absent (Bun, Node < 22.15). The default export of `node:module` is the
 * Module *function*, so this probes for the method directly rather than gating
 * on `typeof === "object"` — which would reject the function and never register.
 */
export function resolveRegisterHooks(
  mod: unknown,
): NodeModuleWithHooks["registerHooks"] | undefined {
  const candidate = (mod as Partial<NodeModuleWithHooks> | null | undefined)
    ?.registerHooks;
  return typeof candidate === "function" ? candidate : undefined;
}

/**
 * Registers a synchronous ESM resolve hook that aliases sibling source
 * extensions (`.ts`↔`.js`, `.mts`↔`.mjs`, `.cts`↔`.cjs`) — the native-Node
 * equivalent of a bundler's extension-alias resolution (e.g. webpack
 * `resolve.extensionAlias`). On ERR_MODULE_NOT_FOUND it retries the sibling
 * extension; literal matches win and nothing is rewritten on disk. No-ops where
 * `module.registerHooks` is unavailable (Bun, Node < 22.15).
 */
export function registerFlowModuleResolver(): void {
  if (registered) return;
  registered = true;

  const registerHooks = resolveRegisterHooks(nodeModule);
  if (registerHooks === undefined) return;

  registerHooks({ resolve: flowResolveHook });
}
