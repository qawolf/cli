import type { StoredSession } from "~/domains/auth/types.js";
import type { Fs } from "~/shell/fs.js";
import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { errorMessage } from "~/core/errors.js";
import { service, tokensAccount, tokensFile } from "./constants.js";
import type { SaveCredentialResult } from "./types.js";

async function saveToFile(
  configDir: string,
  tokens: StoredSession,
  fs: Fs,
): Promise<void> {
  // rwx------ (owner only)
  await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  // Written beside the file and renamed over it: a plain write truncates
  // first, and a command reading the store at that moment would parse half a
  // record and report the session gone. A rename replaces it in one step.
  const target = join(configDir, tokensFile);
  const staging = `${target}.${process.pid}.tmp`;
  // rw------- (owner read/write only)
  await fs.writeFile(staging, JSON.stringify(tokens, undefined, 2), {
    mode: 0o600,
  });
  await fs.rename(staging, target);
}

export async function saveTokens(
  configDir: string,
  tokens: StoredSession,
  fs: Fs,
): Promise<SaveCredentialResult> {
  try {
    new Entry(service, tokensAccount).setPassword(JSON.stringify(tokens));
    return { stored: "keychain" };
  } catch (err: unknown) {
    await saveToFile(configDir, tokens, fs);
    return { stored: "file", keychainError: errorMessage(err) };
  }
}
