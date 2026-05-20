import type { WireError } from "~/shell/platform/createTrpcClient.js";

// `noun` names the kind of API request that failed (e.g. "env-vars"). When
// undefined, messages use the generic phrasing ("request", "that environment"),
// suitable for the canonical signed-URL fetch.
function describeApiRequestError(
  err: WireError,
  baseUrl: string,
  noun: string | undefined,
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

export function describeBundleRequestError(
  err: WireError,
  baseUrl: string,
): string {
  return describeApiRequestError(err, baseUrl, undefined);
}

export function describeEnvVarsRequestError(
  err: WireError,
  baseUrl: string,
): string {
  return describeApiRequestError(err, baseUrl, "env-vars");
}

export function describeTeamStorageRequestError(
  err: WireError,
  baseUrl: string,
): string {
  return describeApiRequestError(err, baseUrl, "team-storage assets");
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
