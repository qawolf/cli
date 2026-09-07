import type { Fs } from "~/shell/fs.js";
import { join } from "node:path";

import type { Entry } from "@napi-rs/keyring";

import { errorMessage } from "~/core/errors.js";
import type { LoadTokensResult, StoredSession } from "~/domains/auth/types.js";
import { service, tokensAccount, tokensFile } from "./constants.js";
import { legacyTokensSchema, oauthTokensSchema } from "./types.js";

type LoadTokensDeps = {
  EntryClass: typeof Entry;
  fs: Pick<Fs, "readFile">;
};

const invalidPayload = "Invalid stored token format";

// A pre-Connect session names no issuer or resource to refresh against, and
// guessing them from the current deployment could bind a refresh to the wrong
// place. Reported as its own thing so the person is told to sign in again
// rather than that their credential store is corrupt.
const legacySession =
  "The stored session predates WorkOS Connect sign-in; sign in again with 'qawolf auth login'";

function parseTokens(
  raw: string,
): { tokens: StoredSession } | { error: string } {
  const json: unknown = JSON.parse(raw);
  const parsed = oauthTokensSchema.safeParse(json);
  if (!parsed.success) {
    const legacy = legacyTokensSchema.safeParse(json);
    return {
      error:
        legacy.success && legacy.data.issuer === undefined
          ? legacySession
          : invalidPayload,
    };
  }
  return {
    tokens: {
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      expiresAt: parsed.data.expiresAt,
      email: parsed.data.email,
      organizationId: parsed.data.organizationId,
      issuer: parsed.data.issuer,
      clientId: parsed.data.clientId,
      resource: parsed.data.resource,
    },
  };
}

export async function loadTokens(
  configDir: string,
  deps: LoadTokensDeps,
): Promise<LoadTokensResult> {
  const errors: { keychain?: string; file?: string } = {};

  try {
    const raw = new deps.EntryClass(service, tokensAccount).getPassword();
    if (raw) {
      const parsed = parseTokens(raw);
      if ("tokens" in parsed) {
        return { found: true, tokens: parsed.tokens, source: "keychain" };
      }
      errors.keychain = parsed.error;
    }
  } catch (err: unknown) {
    errors.keychain = errorMessage(err);
  }

  try {
    const raw = await deps.fs.readFile(join(configDir, tokensFile));
    const parsed = parseTokens(raw);
    if ("tokens" in parsed) {
      return { found: true, tokens: parsed.tokens, source: "file" };
    }
    errors.file = parsed.error;
  } catch (err: unknown) {
    errors.file = errorMessage(err);
  }

  return { found: false, errors };
}
