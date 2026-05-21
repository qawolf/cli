import { mock } from "bun:test";
import type { PlatformClient } from "./createPlatformClient.js";

export function makeMockPlatformClient(
  overrides?: Partial<PlatformClient>,
): PlatformClient {
  const client: PlatformClient = {
    getIdentity: mock<PlatformClient["getIdentity"]>(),
    getFlowsBundleUrl: mock<PlatformClient["getFlowsBundleUrl"]>(),
    getEnvVars: mock<PlatformClient["getEnvVars"]>(),
    listTeamStorageFiles: mock<PlatformClient["listTeamStorageFiles"]>(),
    downloadBundle: mock<PlatformClient["downloadBundle"]>(),
    ...overrides,
  };
  return client;
}
