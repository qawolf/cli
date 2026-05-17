import {
  type GetIdentityResult,
  getIdentity as getIdentityFromPlatform,
} from "~/shell/platform/getIdentity.js";

import type { ValidateApiKeyResult } from "./types.js";

type Dependencies = {
  getIdentity: (apiKey: string, baseUrl: string) => Promise<GetIdentityResult>;
};

const defaultDeps: Dependencies = {
  getIdentity: (apiKey, baseUrl) =>
    getIdentityFromPlatform(apiKey, { baseUrl, fetch: globalThis.fetch }),
};

export async function validateApiKey(
  apiKey: string,
  baseUrl: string,
  deps: Dependencies = defaultDeps,
): Promise<ValidateApiKeyResult> {
  if (!apiKey.trim()) {
    return { valid: false, error: "API key is empty" };
  }

  const result = await deps.getIdentity(apiKey, baseUrl);

  if (!result.ok) {
    if (
      "status" in result &&
      (result.status === 401 || result.status === 403)
    ) {
      return {
        valid: false,
        error: "API key is invalid or unauthorized",
      };
    }
    return {
      valid: false,
      error: `Could not verify API key: ${result.error}`,
    };
  }

  return {
    valid: true,
    team: result.data.team,
  };
}
