import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isNoEntError } from "~/lib/errors.js";

type ConfigureFlowRuntime = (opts: {
  target: unknown;
  webExpectAttributes?: unknown;
}) => Promise<void>;

async function findFlowsRunnerPath(flowPath: string): Promise<string> {
  let dir = path.dirname(flowPath);
  while (true) {
    const pkgPath = path.join(
      dir,
      "node_modules",
      "@qawolf",
      "flows",
      "package.json",
    );
    try {
      const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
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
      const parent = path.dirname(dir);
      if (parent === dir)
        throw new Error(
          `@qawolf/flows not found in node_modules above: ${flowPath}`,
          { cause: err },
        );
      dir = parent;
    }
  }
}

const initCache = new Map<string, Promise<void>>();

async function doInit(flowPath: string): Promise<void> {
  const runnerPath = await findFlowsRunnerPath(flowPath);
  const mod = (await import(pathToFileURL(runnerPath).href)) as {
    configureFlowRuntime?: ConfigureFlowRuntime;
  };
  if (typeof mod.configureFlowRuntime !== "function")
    throw new Error(
      `@qawolf/flows _runner at ${runnerPath} does not export configureFlowRuntime`,
    );
  await mod.configureFlowRuntime({
    target: {
      platform: "web",
      schemaVersion: 1,
      runnerName: "node20WithPlaywright",
      meta: "legacy",
    },
  });
}

export function initFlowRuntime(flowPath: string): Promise<void> {
  const startDir = path.dirname(flowPath);
  let p = initCache.get(startDir);
  if (!p) {
    p = doInit(flowPath);
    initCache.set(startDir, p);
  }
  return p;
}

export function _resetInitCache(): void {
  initCache.clear();
}
