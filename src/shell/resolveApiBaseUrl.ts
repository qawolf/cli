const defaultApiBaseUrl = "https://app.qawolf.com";

/** Resolve the apex API base URL from the environment, trailing slashes
 * trimmed. Shared by the command context and the worker subprocess so both
 * compute the same value. */
export function resolveApiBaseUrl(
  env: Record<string, string | undefined>,
): string {
  return env["QAWOLF_API_URL"]?.replace(/\/+$/, "") || defaultApiBaseUrl;
}
