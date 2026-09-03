import { errorMessage } from "~/core/errors.js";
import { authenticationErrorBody, oauthErrorBody } from "./types.js";

const timeoutMs = 15_000;

export const unexpectedResponse = "WorkOS returned an unexpected response";

/**
 * One WorkOS device-endpoint round trip, reduced to three outcomes so callers
 * never inspect a thrown error. An OAuth error body is a normal part of this
 * protocol — `authorization_pending` arrives as HTTP 400 on every poll — so it
 * is a distinct outcome rather than a failure.
 */
export type WireOutcome =
  | { kind: "json"; json: unknown }
  | { kind: "oauth-error"; code: string; description: string | undefined }
  | { kind: "failure"; detail: string; reachable: boolean };

export async function sendWorkosRequest(
  url: string,
  init: { headers: Record<string, string>; body: string },
  fetchFn: typeof globalThis.fetch,
): Promise<WireOutcome> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: init.headers,
      body: init.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    return {
      kind: "failure",
      detail: `Could not reach WorkOS: ${errorMessage(err)}`,
      reachable: false,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { kind: "failure", detail: unexpectedResponse, reachable: true };
  }

  if (response.ok) return { kind: "json", json };

  const parsed = oauthErrorBody.safeParse(json);
  if (parsed.success) {
    return {
      kind: "oauth-error",
      code: parsed.data.error,
      description: parsed.data.error_description,
    };
  }

  // WorkOS answers some conditions with an authentication error instead, which
  // uses different field names. Without this branch they read as an
  // unrecognised body, which reports a protocol condition as a network fault.
  const authError = authenticationErrorBody.safeParse(json);
  if (authError.success) {
    return {
      kind: "oauth-error",
      code: authError.data.code,
      description: authError.data.message,
    };
  }

  return {
    kind: "failure",
    detail: `${unexpectedResponse} (HTTP ${response.status})`,
    reachable: true,
  };
}
