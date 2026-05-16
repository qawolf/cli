import { createRequire } from "node:module";
import { join } from "node:path";
import type { createTestkitClient } from "@qawolf/testkit/client";
import type { configureTestkitClient } from "@qawolf/testkit";

type ConfigureTestkitDeps = {
  createTestkitClient: typeof createTestkitClient;
  configureTestkitClient: typeof configureTestkitClient;
};

const roadmapLink =
  "https://docs.qawolf.com/qawolf/libraries/testkit/get-started";

function notAvailableLocally(name: string): never {
  throw new Error(
    `${name} is not available in local runs. See ${roadmapLink} for roadmap and availability.`,
  );
}

// Loaded via createRequire from the env dir so the binary resolves the packages
// from the project's node_modules, not from alongside the CLI binary. Tests
// always inject deps.
function loadSdkDeps(cwd: string): ConfigureTestkitDeps {
  try {
    const requireFrom = createRequire(join(cwd, "package.json"));
    const clientPkg = requireFrom("@qawolf/testkit/client") as Pick<
      ConfigureTestkitDeps,
      "createTestkitClient"
    >;
    const mainPkg = requireFrom("@qawolf/testkit") as Pick<
      ConfigureTestkitDeps,
      "configureTestkitClient"
    >;
    return {
      createTestkitClient: clientPkg.createTestkitClient,
      configureTestkitClient: mainPkg.configureTestkitClient,
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
  deps?: ConfigureTestkitDeps,
): Promise<void> {
  const { createTestkitClient, configureTestkitClient } =
    deps ?? loadSdkDeps(cwd);
  const client = createTestkitClient({
    mountCifsShare: () => notAvailableLocally("mountCifsShare"),
    saveSnapshot: () => notAvailableLocally("saveBaselineScreenshot"),
    startOpenVpn: () => notAvailableLocally("startOpenVpn"),
    startWireGuard: () => notAvailableLocally("startWireGuard"),
  });
  configureTestkitClient(client);
}
