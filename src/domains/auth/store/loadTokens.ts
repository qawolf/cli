import type { Fs } from "~/shell/fs.js";
import { join } from "node:path";

import type { Entry } from "@napi-rs/keyring";

import { errorMessage } from "~/core/errors.js";
import type { LoadTokensResult, StoredSession } from "~/domains/auth/types.js";
import { service, tokensAccount, tokensFile } from "./constants.js";
import { oauthTokensSchema } from "./types.js";

type LoadTokensDeps = {
  EntryClass: typeof Entry;
  fs: Pick<Fs, "readFile">;
};

const invalidPayload = "Invalid stored token format";

function parseTokens(raw: string): StoredSession | undefined {
  const parsed = oauthTokensSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return undefined;
  return {
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken,
    expiresAt: parsed.data.expiresAt,
    email: parsed.data.email,
    organizationId: parsed.data.organizationId,
    clientId: parsed.data.clientId,
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
      const tokens = parseTokens(raw);
      if (tokens) return { found: true, tokens, source: "keychain" };
      errors.keychain = invalidPayload;
    }
  } catch (err: unknown) {
    errors.keychain = errorMessage(err);
  }

  try {
    const raw = await deps.fs.readFile(join(configDir, tokensFile));
    const tokens = parseTokens(raw);
    if (tokens) return { found: true, tokens, source: "file" };
    errors.file = invalidPayload;
  } catch (err: unknown) {
    errors.file = errorMessage(err);
  }

  return { found: false, errors };
}
