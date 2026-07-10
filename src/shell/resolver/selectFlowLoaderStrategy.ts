/**
 * How a flow's TypeScript module should be made loadable in the current runtime.
 *
 * - `none`         — the runtime transpiles and resolves TS itself (Bun).
 * - `sync-alias`   — the runtime strips types natively but does not rewrite import
 *                    extensions; a sync `module.registerHooks` hook aliases
 *                    `.js`↔`.ts` siblings (Node 22.18+).
 * - `oxc-transpile`— the runtime does not transpile TS; an async `module.register`
 *                    loader (oxc-node) transpiles and resolves (Node 20.6–22.17).
 * - `unsupported`  — a Node without native TS and without `module.register`
 *                    (Node < 20.6): no way to load a TypeScript flow.
 */
export type FlowLoaderStrategy =
  | "none"
  | "sync-alias"
  | "oxc-transpile"
  | "unsupported";

export type RuntimeCapabilities = {
  /** Running under Bun, which handles TS + resolution natively. */
  readonly isBun: boolean;
  /** `module.registerHooks` is available (Node 22.15+). */
  readonly hasSyncHooks: boolean;
  /** The runtime strips/transforms TypeScript natively (Node 22.18+). */
  readonly hasNativeTypeScript: boolean;
  /** `module.register` is available (Node 20.6+). */
  readonly hasAsyncRegister: boolean;
};

/**
 * Picks the flow-loader strategy from the runtime's capabilities. Pure: callers
 * feature-detect the runtime and pass the booleans in.
 */
export function selectFlowLoaderStrategy(
  caps: RuntimeCapabilities,
): FlowLoaderStrategy {
  if (caps.isBun) return "none";
  if (caps.hasNativeTypeScript) {
    return caps.hasSyncHooks ? "sync-alias" : "none";
  }
  return caps.hasAsyncRegister ? "oxc-transpile" : "unsupported";
}
