import { mock, type Mock } from "bun:test";
import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";

import type { PlatformClient } from "./createPlatformClient.js";
import type { RequestOptions } from "./createTrpcClient.js";
import type { PlatformResult } from "./requestWithRetry.js";

type CallPublicApiFn = (
  contract: AnyPublicApiContract,
  input: unknown,
  options?: RequestOptions,
) => Promise<PlatformResult<unknown>>;

// callPublicApi is a generic method, which bun's mock() cannot express;
// build the mock against a loose signature and cast once at this boundary.
export function makeCallPublicApiMock(): Mock<CallPublicApiFn> &
  PlatformClient["callPublicApi"] {
  return mock<CallPublicApiFn>() as Mock<CallPublicApiFn> &
    PlatformClient["callPublicApi"];
}

export function makeMockPlatformClient(
  overrides?: Partial<PlatformClient>,
): PlatformClient {
  const client: PlatformClient = {
    callPublicApi: makeCallPublicApiMock(),
    getIdentity: mock<PlatformClient["getIdentity"]>(),
    getFlowsBundleUrl: mock<PlatformClient["getFlowsBundleUrl"]>(),
    getEnvVars: mock<PlatformClient["getEnvVars"]>(),
    listTeamStorageFiles: mock<PlatformClient["listTeamStorageFiles"]>(),
    syncTeamStorageAssets: mock<PlatformClient["syncTeamStorageAssets"]>(),
    downloadBundle: mock<PlatformClient["downloadBundle"]>(),
    ...overrides,
  };
  return client;
}
