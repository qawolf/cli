import { errorMessage } from "~/core/errors.js";
import { doctorMessages } from "~/core/messages/index.js";
import type { CheckResult } from "~/domains/doctor/types.js";

type ApiUrlDeps = {
  readonly fetch: typeof globalThis.fetch;
  readonly apiBaseUrl: string;
  readonly timeoutMs?: number;
};

export async function checkApiUrl(deps: ApiUrlDeps): Promise<CheckResult> {
  const timeoutMs = deps.timeoutMs ?? 5_000;

  let response: Response;
  try {
    response = await deps.fetch(deps.apiBaseUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return {
      name: "api-url",
      status: "warn",
      detail: doctorMessages.apiUrl.unreachable(
        deps.apiBaseUrl,
        errorMessage(error),
      ),
    };
  }

  if (!response.ok) {
    return {
      name: "api-url",
      status: "warn",
      detail: doctorMessages.apiUrl.badStatus(deps.apiBaseUrl, response.status),
    };
  }

  return { name: "api-url", status: "pass" };
}
