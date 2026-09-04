import { errorMessage } from "~/core/errors.js";
import { authErrorMessages } from "~/core/messages/authErrors.js";
import { authenticationErrorBody, oauthErrorBody } from "./types.js";

const timeoutMs = 15_000;

export const unexpectedResponse = authErrorMessages.workos.unexpectedResponse;

/**
 * Statuses worth asking again on. A 5xx or a 429 is WorkOS failing rather than
 * refusing, which is transient in the same way a dropped socket is. Every other
 * 4xx is an answer WorkOS meant, and repeating it would change nothing.
 */
function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/**
 * One WorkOS device-endpoint round trip, reduced to three outcomes so callers
 * never inspect a thrown error. An OAuth error body is a normal part of this
 * protocol — `authorization_pending` arrives as HTTP 400 on every poll — so it
 * is a distinct outcome rather than a failure.
 */
export type WireOutcome =
  | { kind: "json"; json: unknown }
  | { kind: "oauth-error"; code: string; description: string | undefined }
  /**
   * `retryable` says whether repeating the request could answer differently.
   * A poller that gives up on a transient fault throws away an approval the
   * person has already granted in their browser and cannot see failing.
   */
  | { kind: "failure"; detail: string; retryable: boolean };

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
      detail: authErrorMessages.workos.unreachable(errorMessage(err)),
      retryable: true,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    // A 2xx whose body will not parse is a proxy or a captive portal answering
    // in place of WorkOS, so the next attempt may well reach the real server.
    return {
      kind: "failure",
      detail: authErrorMessages.workos.unexpectedResponseWithStatus(
        response.status,
      ),
      retryable: response.ok || isTransientStatus(response.status),
    };
  }

  if (response.ok) return { kind: "json", json };

  // Checked before the error bodies below: a 5xx that happens to carry an
  // `error` field is still a server fault, and reading it as a protocol refusal
  // would end the flow on a fault that clears on its own.
  if (isTransientStatus(response.status)) {
    return {
      kind: "failure",
      detail: authErrorMessages.workos.unexpectedResponseWithStatus(
        response.status,
      ),
      retryable: true,
    };
  }

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
    detail: authErrorMessages.workos.unexpectedResponseWithStatus(
      response.status,
    ),
    retryable: false,
  };
}
