import {
  type GetIdentityResult,
  getIdentity as getIdentityFromPlatform,
} from "~/shell/platform/getIdentity.js";

import type { ValidateApiKeyResult } from "./types.js";

type Dependencies = {
  baseUrl: string;
  getIdentity: (apiKey: string, baseUrl: string) => Promise<GetIdentityResult>;
};

export const defaultDeps = {
  getIdentity: (apiKey: string, baseUrl: string): Promise<GetIdentityResult> =>
    getIdentityFromPlatform(apiKey, { baseUrl, fetch: globalThis.fetch }),
};

export async function validateApiKey(
  apiKey: string,
  deps: Dependencies,
): Promise<ValidateApiKeyResult> {
  if (!apiKey.trim()) {
    return { valid: false, error: "API key is empty" };
  }

  const result = await deps.getIdentity(apiKey, deps.baseUrl);

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
