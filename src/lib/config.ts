export function getApiBaseUrl(env: Record<string, string | undefined>): string {
  const envUrl = env["QAWOLF_API_URL"]?.replace(/\/+$/, "");
  return envUrl || "https://app.qawolf.com";
}
