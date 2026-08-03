const registryUrl = "https://registry.npmjs.org";
const timeoutMs = 3000;

type FetchLike = (
  url: string,
  init: { signal: AbortSignal },
) => Promise<Response>;

/**
 * Reads the registry's `latest` dist-tag. Returns undefined on any failure
 * (offline, timeout, bad payload), because the update check must never break
 * a command.
 */
export async function fetchLatestVersion(
  packageName: string,
  deps: { fetchFn?: FetchLike } = {},
): Promise<string | undefined> {
  const fetchFn = deps.fetchFn ?? globalThis.fetch;
  try {
    const response = await fetchFn(`${registryUrl}/${packageName}/latest`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    if (body === null || typeof body !== "object" || !("version" in body)) {
      return undefined;
    }
    return typeof body.version === "string" ? body.version : undefined;
  } catch {
    return undefined;
  }
}
