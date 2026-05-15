import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isNoEntError } from "~/lib/errors.js";

type ConfigureFlowRuntime = (opts: {
  target: unknown;
  webExpectAttributes?: unknown;
}) => Promise<void>;

/**
 * Reads @qawolf/flows/package.json exports map to find the _runner entry path.
 * Walks up from flowPath so we resolve the flow project's copy, not the CLI's.
 */
async function findFlowsRunnerEntry(flowPath: string): Promise<string> {
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
      const raw = await readFile(pkgPath, "utf8");
      const pkg = JSON.parse(raw) as {
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
      if (parent === dir) {
        throw new Error(
          `@qawolf/flows not found in node_modules above: ${flowPath}`,
          { cause: err },
        );
      }
      dir = parent;
    }
  }
}

/**
 * Calls configureFlowRuntime from the flow project's @qawolf/flows — not the
 * CLI's copy. cachedExpect in @qawolf/flows/web is per module instance, so
 * calling the CLI's copy would leave the flow's copy uninitialized.
 *
 * createRequire can't resolve ESM-only packages (no "require" condition), so
 * we walk up from the flow file to find the package directory directly.
 */
export async function initFlowRuntime(flowPath: string): Promise<void> {
  const runnerPath = await findFlowsRunnerEntry(flowPath);
  const mod = (await import(pathToFileURL(runnerPath).href)) as {
    configureFlowRuntime?: ConfigureFlowRuntime;
  };
  if (typeof mod.configureFlowRuntime !== "function") {
    throw new Error(
      `@qawolf/flows _runner at ${runnerPath} does not export configureFlowRuntime`,
    );
  }
  await mod.configureFlowRuntime({
    target: {
      platform: "web",
      schemaVersion: 1,
      runnerName: "node20WithPlaywright",
      meta: "legacy",
    },
  });
}
