import { createRunnerDeps } from "./runnerDeps.js";
import type { RunWebFlowDeps } from "./runWebFlow.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";
import { runnerMessages } from "~/core/messages/index.js";
import { errorMessage } from "~/core/errors.js";

export async function defaultRunWebFlowDeps(
  envDir = process.cwd(),
  signals: SignalRegistry,
): Promise<RunWebFlowDeps> {
  // Loaded via resolveFromEnvDir + import() so the binary finds playwright in
  // the project's node_modules. Dynamic import() also prevents bun's --compile
  // bundler from tracing playwright-core statically — it has optional deps
  // (electron, chromium-bidi) that are not installed and would break the
  // binary build if bundled.
  // Playwright's BrowserType is structurally close to BrowserDep but its
  // newContext() returns Page[].video() = Video | null while MinimalPage
  // expects MinimalVideo | undefined. Runtime values are interchangeable
  // (the runner only reads .path() / .delete() on the video).
  let playwright: Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">;
  try {
    const playwrightPath = resolveFromEnvDir(envDir, "playwright");
    playwright = (await import(playwrightPath)) as Pick<
      RunWebFlowDeps,
      "chromium" | "firefox" | "webkit"
    >;
  } catch (err) {
    throw new Error(
      runnerMessages.playwrightLoadFailed(envDir, errorMessage(err)),
      {
        cause: err,
      },
    );
  }
  const { chromium, firefox, webkit } = playwright;
  return {
    chromium,
    firefox,
    webkit,
    ...createRunnerDeps(signals, envDir),
  };
}
