export function getApiBaseUrl(): string {
  return (
    process.env["QAWOLF_API_URL"]?.replace(/\/+$/, "") ??
    "https://app.qawolf.com"
  );
}
