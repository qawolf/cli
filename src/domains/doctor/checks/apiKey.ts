import { doctorMessages } from "~/core/messages/index.js";
import type { CheckResult } from "~/domains/doctor/types.js";

type ApiKeyDeps = {
  readonly apiKey: string | undefined;
};

export async function checkApiKey(deps: ApiKeyDeps): Promise<CheckResult> {
  if (!deps.apiKey) {
    return {
      name: "api-key",
      status: "warn",
      detail: doctorMessages.apiKey.notFound,
    };
  }
  return { name: "api-key", status: "pass" };
}
