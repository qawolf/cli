import { formatSeconds } from "~/core/formatSeconds.js";
import { authMessages } from "~/core/messages/index.js";
import type { NotFoundHint } from "~/core/publicApi/notFoundHint.js";
import type { WireError } from "./createTrpcClient.js";

const m = authMessages.errors;

export type RequestErrorContext = {
  // Operation label for generic request-failure messages, e.g. "issue.get"
  // or "env-vars".
  noun?: string | undefined;
  // When the command looked up a single resource by id, lets a 404 name the
  // resource, the id, and the flag the user passed.
  notFound?: NotFoundHint | undefined;
  // Commands that resolve their target environment via the --env flag; a 404
  // means that environment wasn't found.
  environmentLookup?: boolean | undefined;
};

function dig(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      node && typeof node === "object"
        ? (node as Record<string, unknown>)[key]
        : undefined,
    value,
  );
}

// Pulls the platform's human-readable message out of a tRPC/superjson error
// body: `{ error: { json: { message, data: { message } } } }`. Returns
// undefined when the body has none, or carries only a bare error code.
export function extractServerMessage(body: string): string | undefined {
  if (!body) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  const message = [
    dig(parsed, ["error", "json", "message"]),
    dig(parsed, ["error", "json", "data", "message"]),
    dig(parsed, ["error", "message"]),
    dig(parsed, ["message"]),
  ].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (message === undefined) return undefined;
  // Bare enum-style codes (NOT_FOUND, BAD_REQUEST) read as noise, not help.
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) return undefined;
  return message;
}

export function describeIdentityError(err: WireError): string {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) {
      return m.identity.invalidOrUnauthorized;
    }
    return m.identity.couldNotVerify(parseErrorBody(err.body), err.status);
  }
  if (err.kind === "network") {
    return m.identity.couldNotVerifyNetwork(err.cause.message);
  }
  if (err.kind === "timeout") return m.identity.timedOut(err.timeoutMs);
  return m.identity.unexpectedFormat;
}

function parseErrorBody(body: string): string {
  if (!body) return "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // not JSON; fall through
  }
  return "";
}

export function describeRequestError(
  err: WireError,
  baseUrl: string,
  context: RequestErrorContext = {},
): string {
  const { noun, notFound, environmentLookup } = context;
  if (err.kind === "http") {
    // The platform sends a human-ready message in the error body for client
    // errors; surface it rather than a bare status. 5xx bodies may carry
    // internal detail, so they stay generic.
    const serverMessage =
      err.status < 500 ? extractServerMessage(err.body) : undefined;
    if (err.status === 401) return m.request.rejected401(noun);
    if (err.status === 403) return m.request.rejected403(noun);
    if (err.status === 404) {
      if (notFound) return m.request.notFoundResource(notFound);
      if (serverMessage) return m.request.notFoundWithMessage(serverMessage);
      if (environmentLookup) return m.request.notFoundEnvironment();
      return m.request.notFound404();
    }
    return m.request.failedWithStatus({
      status: err.status,
      noun,
      serverMessage,
    });
  }
  if (err.kind === "network") {
    return m.request.networkUnreachable(baseUrl, noun);
  }
  if (err.kind === "timeout") return m.request.timedOut(err.timeoutMs, noun);
  return m.request.unexpectedResponse(noun);
}

export function describeBundleDownloadError(err: WireError): string {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) return m.bundle.linkExpired;
    return m.bundle.failedWithStatus(err.status);
  }
  if (err.kind === "network") return m.bundle.networkUnreachable;
  if (err.kind === "timeout") return m.bundle.timedOut(err.timeoutMs);
  return m.bundle.malformed;
}

export function describeTeamStorageDownloadError(
  path: string,
  err: WireError,
): string {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) {
      return `The team-storage download link for ${path} has expired. Please run \`qawolf flows pull\` again to refresh.`;
    }
    return `Could not download team-storage asset ${path} (HTTP ${err.status}).`;
  }
  if (err.kind === "network") {
    return `Could not reach team-storage while downloading ${path}. Check your network connection and try again.`;
  }
  if (err.kind === "timeout") {
    return `Downloading the team-storage asset ${path} timed out after ${formatSeconds(err.timeoutMs)}. Please try again.`;
  }
  return `The team-storage download for ${path} was malformed. Please run \`qawolf flows pull\` again.`;
}
