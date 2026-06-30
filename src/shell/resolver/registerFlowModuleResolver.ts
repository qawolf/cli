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
 * Synchronous ESM resolve hook that retries the sibling source extension when
 * a specifier fails with ERR_MODULE_NOT_FOUND. Literal matches always win;
 * nothing is converted on disk. See registerFlowModuleResolver for why.
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
 * Registers a synchronous Node.js ESM resolve hook that retries the sibling
 * source extension when a specifier fails with ERR_MODULE_NOT_FOUND. Native
 * Node ESM resolves extensions literally, so a flow importing a sibling `.ts`
 * file that ships as `.js` (common in pulled QA Wolf bundles) would otherwise
 * throw; this transparently retries the swapped extension. Literal matches
 * always win; nothing is converted on disk. No-ops on runtimes where
 * `module.registerHooks` is unavailable (e.g. Bun, Node < 22.15).
 */
export function registerFlowModuleResolver(): void {
  if (registered) return;
  const mod: unknown = nodeModule;
  const isHooksAvailable =
    typeof mod === "object" &&
    mod !== null &&
    typeof (mod as Record<string, unknown>)["registerHooks"] === "function";

  if (!isHooksAvailable) {
    registered = true;
    return;
  }

  (mod as NodeModuleWithHooks).registerHooks({ resolve: flowResolveHook });
  registered = true;
}
