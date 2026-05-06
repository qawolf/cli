import type { CheckResult } from "~/doctor/types.js";

type ApiKeyDeps = {
  readonly env: Record<string, string | undefined>;
};

export async function checkApiKey(deps: ApiKeyDeps): Promise<CheckResult> {
  const key = deps.env["QAWOLF_API_KEY"]?.trim();
  if (!key) {
    return {
      name: "api-key",
      status: "warn",
      detail: "QAWOLF_API_KEY is not set",
    };
  }
  return { name: "api-key", status: "pass" };
}
