import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import type { ValidateApiKeyResult } from "./types.js";

type Dependencies = {
  platformClient: PlatformClient;
};

export async function validateApiKey(
  deps: Dependencies,
): Promise<ValidateApiKeyResult> {
  const result = await deps.platformClient.getIdentity();

  if (!result.ok) {
    return { valid: false, error: result.error };
  }

  return {
    valid: true,
    team: result.value.team,
  };
}
