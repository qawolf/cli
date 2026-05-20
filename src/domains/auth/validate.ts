import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import type { ValidateApiKeyResult } from "./types.js";

type Dependencies = {
  platform: PlatformClient;
};

export async function validateApiKey(
  apiKey: string,
  deps: Dependencies,
): Promise<ValidateApiKeyResult> {
  if (!apiKey.trim()) {
    return { valid: false, error: "API key is empty" };
  }

  const result = await deps.platform.getIdentity();

  if (!result.ok) {
    return { valid: false, error: result.error };
  }

  return {
    valid: true,
    team: result.value.team,
  };
}
