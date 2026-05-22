import type { WireError } from "./createTrpcClient.js";

export function describeIdentityError(err: WireError): string {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) {
      return "API key is invalid or unauthorized";
    }
    const detail = parseErrorBody(err.body);
    return `Could not verify API key: ${detail || `HTTP ${err.status}`}`;
  }
  if (err.kind === "network") {
    return `Could not verify API key: ${err.cause.message}`;
  }
  return "Could not verify API key: unexpected response format";
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
  const adj = noun ? ` ${noun}` : "";
  if (err.kind === "http") {
    if (err.status === 401) {
      return `QA Wolf API rejected the${adj} request (HTTP 401). Check your API key.`;
    }
    if (err.status === 403) {
      return `QA Wolf API rejected the${adj} request (HTTP 403). Check that your API key has access to this environment.`;
    }
    if (err.status === 404) {
      const what = noun ? `${noun} for that environment` : "that environment";
      return `QA Wolf API could not find ${what} (HTTP 404). Check the --env value.`;
    }
    return `QA Wolf API${adj} request failed (HTTP ${err.status}).`;
  }
  if (err.kind === "network") {
    const suffix = noun ? ` to fetch ${noun}` : "";
    return `Could not reach the QA Wolf API at ${baseUrl}${suffix}. Check your network connection and QAWOLF_API_URL.`;
  }
  return `Unexpected${adj} response from the QA Wolf API.`;
}

export function describeBundleDownloadError(err: WireError): string {
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) {
      return `The flow bundle download link has expired. Please run \`qawolf flows pull\` again to refresh.`;
    }
    return `Could not download the flow bundle (HTTP ${err.status}).`;
  }
  if (err.kind === "network") {
    return `Could not reach the flow bundle storage. Check your network connection and try again.`;
  }
  return `The flow bundle download was malformed. Please run \`qawolf flows pull\` again.`;
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
