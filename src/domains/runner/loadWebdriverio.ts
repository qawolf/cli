import { errorMessage } from "~/core/errors.js";
import { packageLoadFailed } from "~/core/messages/index.js";
import { importFromPath } from "~/shell/importFromPath.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";

export type WdioRemote = {
  startRecordingScreen(): Promise<void>;
  stopRecordingScreen(): Promise<string>;
  deleteSession(): Promise<void>;
};

export type WebdriverioModule = {
  remote: (opts: Record<string, unknown>) => Promise<WdioRemote>;
};

/**
 * Loads webdriverio from the run's dependency root, where ensureRuntimeEnv
 * installed it on demand. It is a devDependency of the CLI, never a published
 * one, so the npm bundle marks the specifier external and every command starts
 * without parsing the mobile stack.
 *
 * The compiled binary cannot resolve a package's own bare imports out of
 * node_modules (the same limit testkit.ts works around), so it keeps webdriverio
 * inlined and takes the specifier branch, which --define makes static.
 */
export async function loadWebdriverio(
  envDir: string,
): Promise<WebdriverioModule> {
  if (process.env.QAWOLF_COMPILED === "true") {
    return (await import("webdriverio")) as unknown as WebdriverioModule;
  }
  try {
    return (await importFromPath(
      resolveFromEnvDir(envDir, "webdriverio"),
    )) as WebdriverioModule;
  } catch (err) {
    throw new Error(
      packageLoadFailed("webdriverio", envDir, errorMessage(err)),
      {
        cause: err,
      },
    );
  }
}
