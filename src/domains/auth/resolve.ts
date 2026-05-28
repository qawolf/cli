import { Entry } from "@napi-rs/keyring";

import type { Fs } from "~/shell/fs.js";
import { loadApiKey as realLoadApiKey } from "./store/index.js";
import type { ApiKeyResult, LoadApiKeyResult } from "./types.js";

type ResolveApiKeyDeps = {
  loadApiKey: (configDir: string) => Promise<LoadApiKeyResult>;
  env: Record<string, string | undefined>;
};

function makeDefaultDeps(fs: Fs): ResolveApiKeyDeps {
  return {
    loadApiKey: (configDir) =>
      realLoadApiKey(configDir, { EntryClass: Entry, fs }),
    env: process.env,
  };
}

export async function resolveApiKey(
  configDir: string,
  fs: Fs,
  deps?: ResolveApiKeyDeps,
): Promise<ApiKeyResult | undefined> {
  const resolvedDeps = deps ?? makeDefaultDeps(fs);
  const envKey = resolvedDeps.env["QAWOLF_API_KEY"];
  if (envKey?.trim()) {
    return { key: envKey.trim(), source: "env" };
  }

  const stored = await resolvedDeps.loadApiKey(configDir);
  if (stored.found) {
    return { key: stored.key, source: stored.source };
  }

  return undefined;
}

export async function requireApiKey(
  configDir: string,
  fs: Fs,
  deps?: ResolveApiKeyDeps,
): Promise<ApiKeyResult> {
  const result = await resolveApiKey(configDir, fs, deps);
  if (!result) {
    throw new Error(
      "QAWOLF_API_KEY is not set. Set it in your environment, or run 'qawolf auth login'. See 'qawolf doctor'.",
    );
  }
  return result;
}
