export function getApiBaseUrl(): string {
  const envUrl = process.env["QAWOLF_API_URL"]?.replace(/\/+$/, "");
  return envUrl || "https://app.qawolf.com";
}
