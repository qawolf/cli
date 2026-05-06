import { errorMessage } from "~/lib/errors.js";
import type { CheckResult } from "~/doctor/types.js";

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
      detail: `${deps.apiBaseUrl} unreachable: ${errorMessage(error)}`,
    };
  }

  if (!response.ok) {
    return {
      name: "api-url",
      status: "warn",
      detail: `${deps.apiBaseUrl} returned ${response.status}`,
    };
  }

  return { name: "api-url", status: "pass" };
}
