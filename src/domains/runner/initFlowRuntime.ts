import {
  defaultWebPreset,
  parseExecutionTarget,
  type ExecutionTargetOutput,
} from "@qawolf/flow-targets";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isNoEntError } from "~/core/errors.js";

type ConfigureFlowRuntime = (opts: {
  target: ExecutionTargetOutput;
  webExpectAttributes?: { defaultExpectTimeoutMs: number };
  mobileExpectAttributes?: { expectTimeoutMs: number };
}) => Promise<void>;

export type InitFlowRuntimeOptions = {
  /**
   * Default timeout (ms) for flow actions and assertions. Threaded into
   * @qawolf/flows as `defaultExpectTimeoutMs` so the package's `expect`
   * wrapper honors `--timeout`; without it the wrapper pins every assertion
   * to its hardcoded 30s default. The matching Playwright action timeout is
   * applied separately via `context.setDefaultTimeout` at launch.
   */
  timeout: number;
  /**
   * The flow's execution target. Defaults to the web preset: launch() takes
   * the browser from the web flow's own target and reads this one only to
   * rule out Electron. A mobile target makes @qawolf/flows initialize its
   * mobile `expect`.
   */
  target?: ExecutionTargetOutput;
  // When set, resolve @qawolf/flows/_runner from this dir instead of walking up from the flow file.
  depsRoot?: string;
};

/**
 * Reads the @qawolf/flows/_runner export path from a single directory's
 * node_modules. Returns undefined when the package is not present (ENOENT);
 * re-throws any other error (e.g. malformed package.json, missing export).
 */
export async function runnerPathInDir(
  dir: string,
  fs: Fs,
): Promise<string | undefined> {
  const pkgPath = path.join(
    dir,
    "node_modules",
    "@qawolf",
    "flows",
    "package.json",
  );
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath)) as {
      exports?: Record<string, { import?: string } | string>;
    };
    const entry = pkg.exports?.["./_runner"];
    const importPath =
      typeof entry === "object" && entry !== null ? entry.import : undefined;
    if (typeof importPath !== "string") {
      throw new Error(
        `@qawolf/flows at ${pkgPath} does not export "./_runner" with an "import" condition`,
      );
    }
    return path.resolve(path.dirname(pkgPath), importPath);
  } catch (err) {
    if (!isNoEntError(err)) throw err;
    return undefined;
  }
}

async function findFlowsRunnerPath(flowPath: string, fs: Fs): Promise<string> {
  let dir = path.dirname(flowPath);
  while (true) {
    const result = await runnerPathInDir(dir, fs);
    if (result !== undefined) return result;
    const parent = path.dirname(dir);
    if (parent === dir)
      throw new Error(
        `@qawolf/flows not found in node_modules above: ${flowPath}`,
      );
    dir = parent;
  }
}

async function doInit(
  flowPath: string,
  timeout: number,
  target: ExecutionTargetOutput,
  fs: Fs,
  depsRoot?: string,
): Promise<void> {
  let runnerPath: string;
  if (depsRoot !== undefined) {
    const found = await runnerPathInDir(depsRoot, fs);
    if (found === undefined) {
      throw new Error(
        `@qawolf/flows not found in node_modules of depsRoot: ${depsRoot}`,
      );
    }
    runnerPath = found;
  } else {
    runnerPath = await findFlowsRunnerPath(flowPath, fs);
  }
  const mod = (await import(pathToFileURL(runnerPath).href)) as {
    configureFlowRuntime?: ConfigureFlowRuntime;
  };
  if (typeof mod.configureFlowRuntime !== "function")
    throw new Error(
      `@qawolf/flows _runner at ${runnerPath} does not export configureFlowRuntime`,
    );
  const isMobile = target.platform === "android" || target.platform === "ios";
  await mod.configureFlowRuntime({
    target,
    webExpectAttributes: { defaultExpectTimeoutMs: timeout },
    ...(isMobile
      ? { mobileExpectAttributes: { expectTimeoutMs: timeout } }
      : {}),
  });
}

// The @qawolf/flows runtime is process-global, so only the last
// configuration is current. A run in one process can mix web and Android
// flows: a call with a different directory or target configures again.
let lastInit: { key: string; promise: Promise<void> } | undefined;

export function initFlowRuntime(
  flowPath: string,
  options: InitFlowRuntimeOptions,
  fs: Fs = makeDefaultFs(),
): Promise<void> {
  const startDir = path.dirname(flowPath);
  const target = options.target ?? parseExecutionTarget(defaultWebPreset);
  // Cache key is startDir and target, not fs — tests reusing the same startDir
  // must call _resetInitCache() between runs. Timeout is omitted deliberately:
  // it is a single run-global flag, so every flow in a process shares one value.
  const key = `${startDir}\0${JSON.stringify(target)}`;
  if (lastInit?.key !== key) {
    lastInit = {
      key,
      promise: doInit(flowPath, options.timeout, target, fs, options.depsRoot),
    };
  }
  return lastInit.promise;
}

export function _resetInitCache(): void {
  lastInit = undefined;
}
