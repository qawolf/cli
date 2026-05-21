import {
  describeBundleDownloadError,
  describeRequestError,
} from "~/shell/platform/describeErrors.js";
import type { WireError } from "~/shell/platform/createTrpcClient.js";

export { describeBundleDownloadError };

export function describeBundleRequestError(
  err: WireError,
  baseUrl: string,
): string {
  return describeRequestError(err, baseUrl);
}

export function describeEnvVarsRequestError(
  err: WireError,
  baseUrl: string,
): string {
  return describeRequestError(err, baseUrl, "env-vars");
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
