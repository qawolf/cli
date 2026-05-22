import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { errorMessage } from "~/core/errors.js";
import type { LoadApiKeyResult } from "~/domains/auth/types.js";
import { account, credentialsFile, service } from "./constants.js";
import { credentialsFileSchema } from "./types.js";

type LoadApiKeyDeps = {
  EntryClass: typeof Entry;
  fs: Pick<Fs, "readFile">;
};

export async function loadApiKey(
  configDir: string,
  deps: LoadApiKeyDeps = { EntryClass: Entry, fs: makeDefaultFs() },
): Promise<LoadApiKeyResult> {
  const errors: { keychain?: string; file?: string } = {};

  try {
    const entry = new deps.EntryClass(service, account);
    const key = entry.getPassword();
    if (key) return { found: true, key, source: "keychain" };
  } catch (err: unknown) {
    errors.keychain = errorMessage(err);
  }

  try {
    const content = await deps.fs.readFile(join(configDir, credentialsFile));
    const parsed = credentialsFileSchema.safeParse(JSON.parse(content));
    if (parsed.success) {
      return { found: true, key: parsed.data.apiKey, source: "file" };
    }
    errors.file = "Invalid credentials file format";
  } catch (err: unknown) {
    errors.file = errorMessage(err);
  }

  return { found: false, errors };
}
