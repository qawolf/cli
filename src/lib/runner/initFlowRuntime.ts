import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type ConfigureFlowRuntime = (opts: {
  target: unknown;
  webExpectAttributes?: unknown;
}) => Promise<void>;

// Matches the "import" condition in @qawolf/flows exports for "./_runner".
const runnerEntry = path.join(
  "node_modules",
  "@qawolf",
  "flows",
  "dist",
  "_runner",
  "index.js",
);

/**
 * Calls configureFlowRuntime from the flow project's @qawolf/flows — not the
 * CLI's copy. cachedExpect in @qawolf/flows/web is per module instance, so
 * calling the CLI's copy would leave the flow's copy uninitialized.
 *
 * createRequire can't resolve ESM-only packages (no "require" condition), so
 * we walk up from the flow file to find the package directory directly.
 */
export async function initFlowRuntime(flowPath: string): Promise<void> {
  let dir = path.dirname(flowPath);
  let runnerPath: string | undefined;

  while (true) {
    const candidate = path.join(dir, runnerEntry);
    try {
      await access(candidate);
      runnerPath = candidate;
      break;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  if (runnerPath === undefined) {
    throw new Error(
      `@qawolf/flows not found in node_modules above: ${flowPath}`,
    );
  }

  const { configureFlowRuntime } = (await import(
    pathToFileURL(runnerPath).href
  )) as { configureFlowRuntime: ConfigureFlowRuntime };

  await configureFlowRuntime({
    target: {
      platform: "web",
      schemaVersion: 1,
      runnerName: "node20WithPlaywright",
      meta: "legacy",
    },
  });
}
