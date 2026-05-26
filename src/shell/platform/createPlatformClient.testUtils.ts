import { mock } from "bun:test";
import type { PlatformClient } from "./createPlatformClient.js";

export function makeMockPlatformClient(
  overrides?: Partial<PlatformClient>,
): PlatformClient {
  const client: PlatformClient = {
    getIdentity: mock<PlatformClient["getIdentity"]>(),
    getRemoteFlows: mock<PlatformClient["getRemoteFlows"]>(),
    getFlowsBundleUrl: mock<PlatformClient["getFlowsBundleUrl"]>(),
    getEnvVars: mock<PlatformClient["getEnvVars"]>(),
    downloadBundle: mock<PlatformClient["downloadBundle"]>(),
    ...overrides,
  };
  return client;
}
