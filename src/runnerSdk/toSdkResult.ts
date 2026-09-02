import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

import type { SdkResult } from "./types.js";

export function toSdkResult<Value>(
  result: PlatformResult<Value>,
): SdkResult<Value> {
  return result.ok
    ? { ok: true, value: result.value }
    : { error: result.error, ok: false };
}
