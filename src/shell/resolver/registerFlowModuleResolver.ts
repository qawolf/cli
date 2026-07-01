import nodeModule from "node:module";

import { errorCode } from "~/core/errors.js";
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
  return errorCode(err) === "ERR_MODULE_NOT_FOUND";
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
 * Type guard for a `node:module` value that carries `registerHooks`. The default
 * export of `node:module` is the Module *function*, so this admits functions as
 * well as objects rather than gating on `typeof === "object"` — which would
 * reject the function carrier and never register.
 */
function hasRegisterHooks(mod: unknown): mod is NodeModuleWithHooks {
  if (mod === null || (typeof mod !== "object" && typeof mod !== "function")) {
    return false;
  }
  return "registerHooks" in mod && typeof mod.registerHooks === "function";
}

/**
 * Resolves the `registerHooks` static from a `node:module` value, or undefined
 * when absent (Bun, Node < 22.15).
 */
export function resolveRegisterHooks(
  mod: unknown,
): NodeModuleWithHooks["registerHooks"] | undefined {
  return hasRegisterHooks(mod) ? mod.registerHooks : undefined;
}

/**
 * Registers a synchronous ESM resolve hook that aliases sibling source
 * extensions (`.ts`↔`.js`, `.mts`↔`.mjs`, `.cts`↔`.cjs`), retrying the sibling
 * on ERR_MODULE_NOT_FOUND — the native-Node equivalent of a bundler's
 * extension-alias resolution. No-ops where `module.registerHooks` is
 * unavailable (Bun, Node < 22.15).
 */
export function registerFlowModuleResolver(): void {
  if (registered) return;
  registered = true;

  const registerHooks = resolveRegisterHooks(nodeModule);
  if (registerHooks === undefined) return;

  registerHooks({ resolve: flowResolveHook });
}
