const defaultHostUrl = "https://app.qawolf.com";

export function resolveHostUrl(
  env: Record<string, string | undefined>,
): string {
  const configuredHostUrl = env["QAWOLF_HOST_URL"]?.trim();
  if (!configuredHostUrl) return defaultHostUrl;

  return configuredHostUrl.replace(/\/+$/, "");
}
