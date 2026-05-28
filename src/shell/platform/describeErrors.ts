import { authMessages } from "~/core/messages/index.js";
import type { WireError } from "./createTrpcClient.js";

const m = authMessages.errors;

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
  noun?: string,
): string {
  if (err.kind === "http") {
    if (err.status === 401) return m.request.rejected401(noun);
    if (err.status === 403) return m.request.rejected403(noun);
    if (err.status === 404) return m.request.notFound404(noun);
    return m.request.failedWithStatus(err.status, noun);
  }
  if (err.kind === "network") {
    return m.request.networkUnreachable(baseUrl, noun);
  }
  return m.request.unexpectedResponse(noun);
}

export function describeBundleDownloadError(err: WireError): string {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) return m.bundle.linkExpired;
    return m.bundle.failedWithStatus(err.status);
  }
  if (err.kind === "network") return m.bundle.networkUnreachable;
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
  return `The team-storage download for ${path} was malformed. Please run \`qawolf flows pull\` again.`;
}
