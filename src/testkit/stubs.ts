import { pathToFileURL } from "node:url";
import type { createTestkitClient } from "@qawolf/testkit/client";
import type { configureTestkitClient } from "@qawolf/testkit";

type TestkitModule = {
  createTestkitClient: typeof createTestkitClient;
  configureTestkitClient: typeof configureTestkitClient;
};

function notAvailableLocally(name: string): never {
  throw new Error(`${name} is not available in local runs yet.`);
}

// Loaded via import.meta.resolve so the binary finds the packages in the
// project's node_modules rather than alongside the CLI binary. Tests always
// inject deps.
async function loadSdkDeps(cwd: string): Promise<TestkitModule> {
  try {
    const clientMod = (await import(
      import.meta.resolve("@qawolf/testkit/client", pathToFileURL(cwd))
    )) as Pick<TestkitModule, "createTestkitClient">;
    if (typeof clientMod.createTestkitClient !== "function")
      throw new Error("createTestkitClient is not a function");

    const mainMod = (await import(
      import.meta.resolve("@qawolf/testkit", pathToFileURL(cwd))
    )) as Pick<TestkitModule, "configureTestkitClient">;
    if (typeof mainMod.configureTestkitClient !== "function")
      throw new Error("configureTestkitClient is not a function");

    return {
      createTestkitClient: clientMod.createTestkitClient,
      configureTestkitClient: mainMod.configureTestkitClient,
    };
  } catch (err) {
    throw new Error(
      "Could not load @qawolf/testkit. Install it in your project: `npm install @qawolf/testkit` or `bun add @qawolf/testkit`.",
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
