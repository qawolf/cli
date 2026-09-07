import { Entry } from "@napi-rs/keyring";

import { apiResource } from "~/core/deviceAuth/resource.js";
import type { Fs } from "~/shell/fs.js";
import { resolveHostUrl } from "~/shell/resolveHostUrl.js";
import { discoverIssuer } from "~/shell/workos/discoverIssuer.js";
import { refreshAccessToken } from "~/shell/workos/refreshAccessToken.js";
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

function makeOauthDeps(fs: Fs, apiBaseUrl: string): ResolveOauthTokenDeps {
  return {
    loadTokens: (configDir) =>
      realLoadTokens(configDir, { EntryClass: Entry, fs }),
    // The stored session names its issuer, client and resource, so renewing a
    // token asks the deployment nothing. The issuer is still asked where its
    // token endpoint is: metadata is cheap, and pinning an endpoint would
    // outlive a provider that moved it.
    refreshTokens: async ({ refreshToken, issuer, clientId, resource }) => {
      const endpoints = await discoverIssuer(issuer, globalThis.fetch);
      if (!endpoints.ok) return endpoints;
      return refreshAccessToken(refreshToken, {
        fetch: globalThis.fetch,
        clientId,
        resource,
        endpoints: endpoints.value,
      });
    },
    saveTokens: (configDir, tokens) => realSaveTokens(configDir, tokens, fs),
    now: () => Date.now(),
    resource: apiResource(apiBaseUrl),
  };
}

function makeDefaultDeps(fs: Fs): ResolveApiKeyDeps {
  const env = process.env;
  return {
    loadApiKey: (configDir) =>
      realLoadApiKey(configDir, { EntryClass: Entry, fs }),
    resolveOauth: (configDir) =>
      resolveOauthToken(configDir, makeOauthDeps(fs, resolveHostUrl(env))),
    env,
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
