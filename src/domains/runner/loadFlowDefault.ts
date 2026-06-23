import path from "node:path";
import { pathToFileURL } from "node:url";

import { runnerMessages } from "~/core/messages/index.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";

// Native browser drivers stay bare so they resolve via the node_modules symlink
// at the flow's bundle root instead of being inlined into the bundle.
const browserDrivers = [
  "playwright",
  "playwright-core",
  "patchright",
  "patchright-core",
];

// Pre-bundles a flow's full import tree into a single ESM source string.
type FlowBundler = (flowPath: string) => Promise<string>;

type BunBuildResult = {
  success: boolean;
  outputs: { text(): Promise<string> }[];
  logs: { message: string }[];
};

// Structural type read from globalThis to avoid the no-restricted-globals lint
// rule; Bun.build exists in the compiled binary but not the Node.js build.
type BunBuild = (config: {
  entrypoints: string[];
  target?: string;
  format?: string;
  external?: string[];
}) => Promise<BunBuildResult>;

function getBunBuild(): BunBuild | undefined {
  return (globalThis as { Bun?: { build?: BunBuild } }).Bun?.build;
}

// Compiled Bun binaries cannot resolve exports-map bare specifiers from external
// node_modules, but Bun.build (available inside the binary) can. Pre-bundle the
// flow so everything except the native browser drivers is inlined.
async function defaultFlowBundler(flowPath: string): Promise<string> {
  const build = getBunBuild();
  if (build === undefined)
    throw new Error("Cannot bundle flow: Bun.build is unavailable");

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

// Only the compiled binary needs bundling — it alone cannot resolve exports-map
// bare specifiers from external node_modules. Node and `bun run`/`bun test`
// resolve them directly, so they take the direct-import path. QAWOLF_COMPILED is
// injected via --define at binary build time (see build:binary in package.json).
// Tests inject bundleFlow explicitly to exercise either path deterministically.
const defaultBundleFlow: FlowBundler | undefined =
  process.env.QAWOLF_COMPILED === "true" ? defaultFlowBundler : undefined;

type LoadFlowDefaultArgs = {
  flowPath: string;
  fs?: Fs;
  // Injectable for tests. When defined, the flow is pre-bundled (compiled-binary
  // path); when undefined, the flow is imported directly (Node path).
  bundleFlow?: FlowBundler | undefined;
};

// Imports a module by URL and returns its default export, throwing the canonical
// no-default-export error when absent.
async function importDefaultExport<T>(
  moduleUrl: string,
  flowPath: string,
): Promise<T> {
  const mod = (await import(moduleUrl)) as Record<string, unknown>;
  const exported = mod["default"] as T | undefined;
  if (exported === undefined)
    throw new Error(runnerMessages.noDefaultExport(flowPath));
  return exported;
}

// Imports the bundled flow from a temp sibling of flowPath so the externalized
// browser-driver bare imports resolve via the node_modules symlink at the flow's
// bundle root. The temp file is always removed afterward.
async function importBundledFlow<T>(
  flowPath: string,
  code: string,
  fs: Fs,
): Promise<T> {
  const tempPath = path.join(
    path.dirname(flowPath),
    `.${path.basename(flowPath)}.qawolf-bundle.mjs`,
  );
  await fs.writeFile(tempPath, code);
  try {
    return await importDefaultExport<T>(pathToFileURL(tempPath).href, flowPath);
  } finally {
    await fs.rm(tempPath, { force: true });
  }
}

export async function loadFlowDefault<T>(
  args: LoadFlowDefaultArgs,
): Promise<T> {
  const {
    flowPath,
    fs = makeDefaultFs(),
    bundleFlow = defaultBundleFlow,
  } = args;

  if (bundleFlow === undefined) {
    return importDefaultExport<T>(pathToFileURL(flowPath).href, flowPath);
  }

  const code = await bundleFlow(flowPath);
  return importBundledFlow<T>(flowPath, code, fs);
}
