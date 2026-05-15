import type { TestkitClient, TestkitPorts } from "@qawolf/testkit/client";

type ConfigureTestkitDeps = {
  createTestkitClient: (ports: TestkitPorts) => TestkitClient;
  configureTestkitClient: (client: TestkitClient) => void;
};

const roadmapLink =
  "https://docs.qawolf.com/qawolf/libraries/testkit/get-started";

function notAvailableLocally(name: string): never {
  throw new Error(
    `${name} is not available in local runs. See ${roadmapLink} for roadmap and availability.`,
  );
}

// Dynamic import prevents @qawolf/testkit from loading at module init time,
// mirroring the configureEmails pattern. Tests always inject deps.
async function loadSdkDeps(): Promise<ConfigureTestkitDeps> {
  try {
    const [{ createTestkitClient }, { configureTestkitClient }] =
      await Promise.all([
        import("@qawolf/testkit/client"),
        import("@qawolf/testkit"),
      ]);
    return { createTestkitClient, configureTestkitClient };
  } catch (err) {
    throw new Error(
      "Could not load @qawolf/testkit. Install it in your project: `npm install @qawolf/testkit` or `bun add @qawolf/testkit`.",
      { cause: err },
    );
  }
}

export async function configureTestkit(
  deps?: ConfigureTestkitDeps,
): Promise<void> {
  const { createTestkitClient, configureTestkitClient } =
    deps ?? (await loadSdkDeps());
  const client = createTestkitClient({
    mountCifsShare: () => notAvailableLocally("mountCifsShare"),
    saveSnapshot: () => notAvailableLocally("saveBaselineScreenshot"),
    startOpenVpn: () => notAvailableLocally("startOpenVpn"),
    startWireGuard: () => notAvailableLocally("startWireGuard"),
  });
  configureTestkitClient(client);
}
