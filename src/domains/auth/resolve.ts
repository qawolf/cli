import { loadApiKey } from "./store/index.js";
import type { ApiKeyResult, LoadApiKeyResult } from "./types.js";

type ResolveApiKeyDeps = {
  loadApiKey: (configDir: string) => Promise<LoadApiKeyResult>;
  env: Record<string, string | undefined>;
};

export async function resolveApiKey(
  configDir: string,
  deps: ResolveApiKeyDeps = { loadApiKey, env: process.env },
): Promise<ApiKeyResult | undefined> {
  const envKey = deps.env["QAWOLF_API_KEY"];
  if (envKey?.trim()) {
    return { key: envKey.trim(), source: "env" };
  }

  const stored = await deps.loadApiKey(configDir);
  if (stored.found) {
    return { key: stored.key, source: stored.source };
  }

  return undefined;
}

export async function requireApiKey(
  configDir: string,
  deps: ResolveApiKeyDeps = { loadApiKey, env: process.env },
): Promise<ApiKeyResult> {
  const result = await resolveApiKey(configDir, deps);
  if (!result) {
    throw new Error(
      "QAWOLF_API_KEY is not set. Set it in your environment, or run 'qawolf auth login'. See 'qawolf doctor'.",
    );
  }
  return result;
}
