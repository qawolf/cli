import { Entry } from "@napi-rs/keyring";

import type { Fs } from "~/shell/fs.js";
import { refreshAccessToken } from "~/shell/workos/refreshAccessToken.js";
import { resolveWorkosConfig } from "~/shell/workos/config.js";
import { loadApiKey as realLoadApiKey } from "./store/index.js";
import { loadTokens as realLoadTokens } from "./store/loadTokens.js";
import { saveTokens as realSaveTokens } from "./store/saveTokens.js";
import {
  type OauthToken,
  resolveOauthToken,
  type ResolveOauthTokenDeps,
} from "./resolveOauthToken.js";
import type { ApiKeyResult, LoadApiKeyResult } from "./types.js";

type ResolveApiKeyDeps = {
  loadApiKey: (configDir: string) => Promise<LoadApiKeyResult>;
  resolveOauth: (configDir: string) => Promise<OauthToken | undefined>;
  env: Record<string, string | undefined>;
};

function makeOauthDeps(fs: Fs): ResolveOauthTokenDeps {
  return {
    loadTokens: (configDir) =>
      realLoadTokens(configDir, { EntryClass: Entry, fs }),
    // The stored session names its issuing client, so renewing a token asks
    // the deployment nothing.
    refreshTokens: async ({ refreshToken, organizationId, clientId }) => {
      const config = resolveWorkosConfig(clientId);
      if (!config.configured) {
        return { ok: false, error: "This session names no WorkOS client" };
      }
      return refreshAccessToken(
        refreshToken,
        {
          fetch: globalThis.fetch,
          baseUrl: config.baseUrl,
          clientId: config.clientId,
        },
        organizationId,
      );
    },
    saveTokens: (configDir, tokens) => realSaveTokens(configDir, tokens, fs),
    now: () => Date.now(),
  };
}

function makeDefaultDeps(fs: Fs): ResolveApiKeyDeps {
  return {
    loadApiKey: (configDir) =>
      realLoadApiKey(configDir, { EntryClass: Entry, fs }),
    resolveOauth: (configDir) =>
      resolveOauthToken(configDir, makeOauthDeps(fs)),
    env: process.env,
  };
}

/**
 * Finds the credential the CLI should present, highest precedence first: the
 * environment variable, then a stored API key, then browser sign-in.
 *
 * An API key outranks browser sign-in because it carries team scope that a user
 * token does not, so someone holding both keeps the broader access.
 */
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

  const oauth = await resolvedDeps.resolveOauth(configDir);
  if (oauth) {
    return { key: oauth.key, source: "browser" };
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
