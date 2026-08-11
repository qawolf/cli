import { formatSeconds } from "~/core/formatSeconds.js";
import { authMessages } from "~/core/messages/index.js";
import type { WireError } from "./createTrpcClient.js";
import { parseErrorBody } from "./parseErrorBody.js";
import type { PlatformError } from "./requestWithRetry.js";

const m = authMessages.errors;

/** Identity failures inline the reason into a single line, so keep it short. */
const inlineReasonMaxLength = 200;

export function describeIdentityError(err: WireError): PlatformError {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) {
      return { error: m.identity.invalidOrUnauthorized };
    }
    return {
      error: m.identity.couldNotVerify(
        parseErrorBody(err.body, inlineReasonMaxLength),
        err.status,
      ),
    };
  }
  if (err.kind === "network") {
    return { error: m.identity.couldNotVerifyNetwork(err.cause.message) };
  }
  if (err.kind === "timeout") {
    return { error: m.identity.timedOut(err.timeoutMs) };
  }
  return { error: m.identity.unexpectedFormat };
}

// The title stays short and stable so a caller can branch on it; the server's
// reason goes in the body.
export function describeRequestError(
  err: WireError,
  baseUrl: string,
  noun?: string,
): PlatformError {
  if (err.kind === "http") {
    const reason = parseErrorBody(err.body);
    const body = reason ? { errorBody: reason } : {};
    if (err.status === 401)
      return { error: m.request.rejected401(noun), ...body };
    if (err.status === 403)
      return { error: m.request.rejected403(noun), ...body };
    if (err.status === 404)
      return { error: m.request.notFound404(noun), ...body };
    return { error: m.request.failedWithStatus(err.status, noun), ...body };
  }
  if (err.kind === "network") {
    return { error: m.request.networkUnreachable(baseUrl, noun) };
  }
  if (err.kind === "timeout") {
    return { error: m.request.timedOut(err.timeoutMs, noun) };
  }
  return { error: m.request.unexpectedResponse(noun) };
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
