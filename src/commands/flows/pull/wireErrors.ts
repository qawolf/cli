import type { WireError } from "~/apex/createTrpcClient.js";

export function describeBundleRequestError(
  err: WireError,
  baseUrl: string,
): string {
  if (err.kind === "http") {
    if (err.status === 401) {
      return `QA Wolf API rejected the request (HTTP 401). Check your API key.`;
    }
    if (err.status === 403) {
      return `QA Wolf API rejected the request (HTTP 403). Check that your API key has access to this environment.`;
    }
    if (err.status === 404) {
      return `QA Wolf API could not find that environment (HTTP 404). Check the --env value.`;
    }
    return `QA Wolf API request failed (HTTP ${err.status}).`;
  }
  if (err.kind === "network") {
    return `Could not reach the QA Wolf API at ${baseUrl}. Check your network connection and QAWOLF_API_URL.`;
  }
  return `Unexpected response from the QA Wolf API.`;
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
