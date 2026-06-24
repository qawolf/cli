import path from "node:path";
import { pathToFileURL } from "node:url";

import { runnerMessages } from "~/core/messages/index.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { type FlowBundler, defaultFlowBundler } from "./bundleFlow.js";

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
  // Executor root whose node_modules holds @qawolf/flows etc. Required when
  // bundleFlow is defined; unused on the direct-import path.
  depsRoot?: string;
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
    depsRoot = "",
  } = args;

  if (bundleFlow === undefined) {
    return importDefaultExport<T>(pathToFileURL(flowPath).href, flowPath);
  }

  const code = await bundleFlow(flowPath, depsRoot);
  return importBundledFlow<T>(flowPath, code, fs);
}
