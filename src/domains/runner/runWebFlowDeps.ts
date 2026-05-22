import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createRunnerDeps } from "./runnerDeps.js";
import type { RunWebFlowDeps } from "./runWebFlow.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

export async function defaultRunWebFlowDeps(
  cwd = process.cwd(),
  signals: SignalRegistry,
): Promise<RunWebFlowDeps> {
  // Loaded via import.meta.resolve so the binary finds playwright in the
  // project's node_modules rather than alongside the CLI binary. Dynamic
  // import() also prevents bun's --compile bundler from tracing playwright-core
  // statically — it has optional deps (electron, chromium-bidi) that are not
  // installed and would break the binary build if bundled.
  // Playwright's BrowserType is structurally close to BrowserDep but its
  // newContext() returns Page[].video() = Video | null while MinimalPage
  // expects MinimalVideo | undefined. Runtime values are interchangeable
  // (the runner only reads .path() / .delete() on the video).
  // Point to a file inside cwd so import.meta.resolve starts node_modules
  // lookup from cwd/ rather than its parent (pathToFileURL of a directory
  // produces a URL without trailing slash, which is treated as a file).
  const base = pathToFileURL(join(cwd, "package.json"));
  let playwright: Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">;
  try {
    playwright = (await import(
      import.meta.resolve("playwright", base)
    )) as Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">;
  } catch (err) {
    throw new Error(
      "Could not load Playwright. Install it in your project: `npm install playwright` or `bun add playwright`.",
      { cause: err },
    );
  }
  const { chromium, firefox, webkit } = playwright;
  return {
    chromium,
    firefox,
    webkit,
    ...createRunnerDeps(signals),
  };
}
