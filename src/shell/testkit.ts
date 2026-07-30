import { join } from "node:path";
import type { createTestkitClient } from "@qawolf/testkit/client";
import type { configureTestkitClient } from "@qawolf/testkit";

import { runnerMessages } from "~/core/messages/index.js";
import { resolveFromEnvDir } from "~/shell/resolveExport.js";
import { packageLoadFailed } from "~/core/messages/index.js";
import { errorMessage } from "~/core/errors.js";
type TestkitModule = {
  createTestkitClient: typeof createTestkitClient;
  configureTestkitClient: typeof configureTestkitClient;
};

function notAvailableLocally(name: string): never {
  throw new Error(runnerMessages.notAvailableLocally(name));
}

// Loaded via resolveFromEnvDir + import() so the binary finds the packages in
// the project's node_modules. Tests always inject deps.
//
// @qawolf/testkit (main entry) imports 'otpauth', a bare specifier that Bun's
// compiled binary cannot resolve from inside node_modules/@qawolf/testkit/
// (scoped-package traversal bug). configureTestkitClient is re-exported from
// the package's internal dist/clientScope.js, which has no external deps and
// loads correctly. Loading from the internal path avoids the bug while still
// sharing the same module instance as test files that import @qawolf/testkit.
async function loadSdkDeps(cwd: string): Promise<TestkitModule> {
  const testkitDir = join(cwd, "node_modules", "@qawolf", "testkit");
  try {
    const clientMod = (await import(
      resolveFromEnvDir(cwd, "@qawolf/testkit/client")
    )) as Pick<TestkitModule, "createTestkitClient">;
    if (typeof clientMod.createTestkitClient !== "function")
      throw new Error("createTestkitClient is not a function");

    // TODO WIZ-10612: route through resolveFromEnvDir once @qawolf/testkit
    // exposes a dedicated exports-map entry, or Bun fixes the scoped-package
    // traversal bug that prevents loading the main entry here.
    const scopeMod = (await import(
      join(testkitDir, "dist", "clientScope.js")
    )) as Pick<TestkitModule, "configureTestkitClient">;
    if (typeof scopeMod.configureTestkitClient !== "function")
      throw new Error("configureTestkitClient is not a function");

    return {
      createTestkitClient: clientMod.createTestkitClient,
      configureTestkitClient: scopeMod.configureTestkitClient,
    };
  } catch (err) {
    throw new Error(
      packageLoadFailed("@qawolf/testkit", cwd, errorMessage(err)),
      { cause: err },
    );
  }
}

export async function configureTestkit(
  cwd: string,
  deps?: TestkitModule,
): Promise<void> {
  const { createTestkitClient, configureTestkitClient } =
    deps ?? (await loadSdkDeps(cwd));
  const client = createTestkitClient({
    mountCifsShare: () => notAvailableLocally("mountCifsShare"),
    saveSnapshot: () => notAvailableLocally("saveBaselineScreenshot"), // Port key is saveSnapshot; platform capability is saveBaselineScreenshot
    startOpenVpn: () => notAvailableLocally("startOpenVpn"),
    startWireGuard: () => notAvailableLocally("startWireGuard"),
  });
  configureTestkitClient(client);
}
