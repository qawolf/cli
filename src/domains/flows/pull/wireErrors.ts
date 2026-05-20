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
