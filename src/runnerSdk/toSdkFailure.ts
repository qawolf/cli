import type { PlatformFailure } from "~/shell/platform/requestWithRetry.js";

import type { SdkResult } from "./types.js";

export type SdkFailure = Extract<SdkResult<never>, { ok: false }>;

/**
 * A failure from an inner layer, as the SDK's own shape.
 *
 * Keeps the detail line rather than the headline alone: for a runner that is
 * not running, the headline names it and the detail says why and what to do
 * about it, which is the half a caller acts on.
 */
export function toSdkFailure(failure: PlatformFailure): SdkFailure {
  return {
    error: failure.error,
    ...(failure.errorBody ? { errorDetail: failure.errorBody } : {}),
    ok: false,
  };
}
