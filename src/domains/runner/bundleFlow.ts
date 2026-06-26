import { makeDefaultFs } from "~/shell/fs.js";
import {
  type BunPlugin,
  createExternalizeExecutorPlugin,
} from "./executorPlugin.js";

/**
 * Native browser drivers stay bare so they resolve via the node_modules symlink
 * at the flow's bundle root instead of being inlined into the bundle.
 */
const browserDrivers = [
  "playwright",
  "playwright-core",
  "patchright",
  "patchright-core",
];

/**
 * Pre-bundles a flow's full import tree into a single ESM source string.
 * depsRoot is the executor root whose node_modules holds @qawolf/flows etc.
 */
export type FlowBundler = (
  flowPath: string,
  depsRoot: string,
) => Promise<string>;

type BunBuildResult = {
  success: boolean;
  outputs: { text(): Promise<string> }[];
  logs: { message: string }[];
};

/**
 * Structural type read from globalThis to avoid the no-restricted-globals lint
 * rule; Bun.build exists in the compiled binary but not the Node.js build.
 */
type BunBuild = (config: {
  entrypoints: string[];
  target?: string;
  format?: string;
  external?: string[];
  plugins?: BunPlugin[];
}) => Promise<BunBuildResult>;

function getBunBuild(): BunBuild | undefined {
  return (globalThis as { Bun?: { build?: BunBuild } }).Bun?.build;
}

/**
 * Compiled Bun binaries cannot resolve exports-map bare specifiers from
 * external node_modules, but Bun.build (available inside the binary) can.
 * Pre-bundles the flow so everything except the native browser drivers and
 * executor packages is inlined. Executor packages are externalized to absolute
 * on-disk paths so the runner and the flow share one AsyncLocalStorage instance.
 */
export async function defaultFlowBundler(
  flowPath: string,
  depsRoot: string,
): Promise<string> {
  const build = getBunBuild();
  if (build === undefined)
    throw new Error("Cannot bundle flow: Bun.build is unavailable");

  const fs = makeDefaultFs();

  // Bun.build throws an AggregateError (with per-error messages on `.errors`) on
  // resolve/parse failures rather than returning success:false, so surface those
  // messages — otherwise the flow fails with an opaque "Bundle failed".
  let result: BunBuildResult;
  try {
    result = await build({
      entrypoints: [flowPath],
      target: "bun",
      format: "esm",
      external: browserDrivers,
      plugins: [createExternalizeExecutorPlugin(depsRoot, fs)],
    });
  } catch (err) {
    const aggregate = err as { errors?: { message?: string }[] };
    const detail = Array.isArray(aggregate.errors)
      ? aggregate.errors.map((e) => e.message ?? "unknown error").join("\n")
      : err instanceof Error
        ? err.message
        : "unknown error";
    throw new Error(`Failed to bundle flow ${flowPath}:\n${detail}`, {
      cause: err,
    });
  }
  const [output] = result.outputs;
  if (!result.success || !output) {
    const logs = result.logs.map((entry) => entry.message).join("\n");
    throw new Error(`Failed to bundle flow ${flowPath}:\n${logs}`);
  }
  return output.text();
}
