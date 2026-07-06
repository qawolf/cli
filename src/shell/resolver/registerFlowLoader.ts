import { detectRuntimeCapabilities } from "./detectRuntimeCapabilities.js";
import { registerFlowModuleResolver } from "./registerFlowModuleResolver.js";
import {
  type RuntimeCapabilities,
  selectFlowLoaderStrategy,
} from "./selectFlowLoaderStrategy.js";

/**
 * Imports oxc-node's ESM/CJS loader, which self-registers via `module.register`
 * (Node 20.6+) and transpiles + resolves TypeScript flows. Idempotent: the ESM
 * module cache runs the registration side effect once per process. Kept as a
 * bare dynamic import so `@oxc-node/core` stays external in the npm bundle and
 * is loaded only on the Node path that needs it (never in the Bun binary).
 */
async function defaultRegisterOxcLoader(): Promise<void> {
  try {
    await import("@oxc-node/core/register");
  } catch (cause) {
    // Missing package or a native-addon load failure for this platform — give an
    // actionable message instead of a raw module-resolution/binding error.
    throw new Error(
      `Failed to load the @oxc-node/core TypeScript loader needed to run ` +
        `flows on Node ${process.version}. Ensure @oxc-node/core is installed ` +
        `for this platform (${process.platform}-${process.arch}).`,
      { cause },
    );
  }
}

type RegisterFlowLoaderDeps = {
  capabilities?: RuntimeCapabilities;
  registerSyncAlias?: () => void;
  registerOxcLoader?: () => Promise<void>;
};

/**
 * Makes flow `.ts` modules loadable by the current runtime, choosing the
 * cheapest capable mechanism (see selectFlowLoaderStrategy). No-ops where the
 * runtime already handles TypeScript and resolution itself (Bun).
 */
export async function registerFlowLoader(
  deps: RegisterFlowLoaderDeps = {},
): Promise<void> {
  const {
    capabilities = detectRuntimeCapabilities(),
    registerSyncAlias = registerFlowModuleResolver,
    registerOxcLoader = defaultRegisterOxcLoader,
  } = deps;

  const strategy = selectFlowLoaderStrategy(capabilities);
  if (strategy === "sync-alias") {
    registerSyncAlias();
  } else if (strategy === "oxc-transpile") {
    await registerOxcLoader();
  } else if (strategy === "unsupported") {
    throw new Error(
      `Running TypeScript flows requires Node 20.6+ (for module.register) or a ` +
        `runtime with native TypeScript support. Current runtime: ${process.version}. ` +
        `Upgrade Node to 20.6 or newer.`,
    );
  }
}
