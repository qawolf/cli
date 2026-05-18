import { mkdir, writeFile } from "~/shell/fs.js";
import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { errorMessage } from "~/core/errors.js";
import { account, credentialsFile, service } from "./constants.js";
import type { CredentialsFile, SaveApiKeyResult } from "./types.js";

async function saveToFile(configDir: string, key: string): Promise<void> {
  const payload: CredentialsFile = { apiKey: key };
  // rwx------ (owner only)
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  // rw------- (owner read/write only)
  await writeFile(
    join(configDir, credentialsFile),
    JSON.stringify(payload, undefined, 2),
    { mode: 0o600 },
  );
}

export async function saveApiKey(
  configDir: string,
  key: string,
): Promise<SaveApiKeyResult> {
  try {
    const entry = new Entry(service, account);
    entry.setPassword(key);
    return { stored: "keychain" };
  } catch (err: unknown) {
    await saveToFile(configDir, key);
    return { stored: "file", keychainError: errorMessage(err) };
  }
}
