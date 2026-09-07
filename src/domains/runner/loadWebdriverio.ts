import type { remote } from "webdriverio";

import { errorMessage } from "~/core/errors.js";
import { packageLoadFailed } from "~/core/messages/index.js";
import { importFromPath } from "~/shell/importFromPath.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";

export type WebdriverioModule = { remote: typeof remote };

/**
 * Loads webdriverio from the run's dependency root, where the managed runtime
 * installs it on first use; the npm bundle does not ship it. The compiled
 * binary cannot resolve a package's own bare imports out of node_modules, so
 * it keeps webdriverio inlined and takes the specifier branch instead.
 */
export async function loadWebdriverio(
  envDir: string,
): Promise<WebdriverioModule> {
  if (process.env.QAWOLF_COMPILED === "true") return import("webdriverio");
  try {
    return (await importFromPath(
      resolveFromEnvDir(envDir, "webdriverio"),
    )) as WebdriverioModule;
  } catch (err) {
    throw new Error(
      packageLoadFailed("webdriverio", envDir, errorMessage(err)),
      { cause: err },
    );
  }
}
