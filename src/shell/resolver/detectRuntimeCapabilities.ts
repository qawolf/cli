import nodeModule from "node:module";

import { resolveRegisterHooks } from "./registerFlowModuleResolver.js";
import type { RuntimeCapabilities } from "./selectFlowLoaderStrategy.js";

/**
 * Feature-detects the current runtime's TypeScript + module-hook capabilities.
 * Kept thin: all decision logic lives in selectFlowLoaderStrategy so it stays
 * testable without spawning real runtimes.
 */
export function detectRuntimeCapabilities(): RuntimeCapabilities {
  return {
    isBun: (globalThis as { Bun?: unknown }).Bun !== undefined,
    hasSyncHooks: resolveRegisterHooks(nodeModule) !== undefined,
    // process.features.typescript is false, "strip", or "transform" (Node 22.18+).
    hasNativeTypeScript: Boolean(
      (process.features as { typescript?: unknown }).typescript,
    ),
    hasAsyncRegister:
      typeof (nodeModule as { register?: unknown }).register === "function",
  };
}
