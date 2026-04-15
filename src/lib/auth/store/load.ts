import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { errorMessage } from "~/lib/errors.js";
import type { LoadApiKeyResult } from "~/lib/auth/types.js";
import { ACCOUNT, CREDENTIALS_FILE, SERVICE } from "./constants.js";
import { credentialsFileSchema } from "./types.js";

export async function loadApiKey(configDir: string): Promise<LoadApiKeyResult> {
  const errors: { keychain?: string; file?: string } = {};

  try {
    const entry = new Entry(SERVICE, ACCOUNT);
    const key = entry.getPassword();
    if (key) return { found: true, key, source: "keychain" };
  } catch (err: unknown) {
    errors.keychain = errorMessage(err);
  }

  try {
    const content = await readFile(join(configDir, CREDENTIALS_FILE), "utf-8");
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
