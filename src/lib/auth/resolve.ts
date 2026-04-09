import { loadApiKey } from "./store/index.js";
import type { ApiKeyResult } from "./types.js";

export async function resolveApiKey(
  configDir: string,
): Promise<ApiKeyResult | undefined> {
  const envKey = process.env["QAWOLF_API_KEY"];
  if (envKey?.trim()) {
    return { key: envKey.trim(), source: "env" };
  }

  const stored = await loadApiKey(configDir);
  if (stored.found) {
    return { key: stored.key, source: stored.source };
  }

  return undefined;
}
