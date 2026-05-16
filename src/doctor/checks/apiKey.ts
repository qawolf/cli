import type { CheckResult } from "~/doctor/types.js";

type ApiKeyDeps = {
  readonly apiKey: string | undefined;
};

export async function checkApiKey(deps: ApiKeyDeps): Promise<CheckResult> {
  if (!deps.apiKey) {
    return {
      name: "api-key",
      status: "warn",
      detail:
        "No API key found. Set QAWOLF_API_KEY or run `qawolf auth login`.",
    };
  }
  return { name: "api-key", status: "pass" };
}
