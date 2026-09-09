import type { StoredSession } from "~/domains/auth/types.js";
import type { Fs } from "~/shell/fs.js";
import { randomUUID } from "node:crypto";
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
  // Per call, not per process: the workers of one `flows run` can all save
  // at once, and two writes sharing a staging name would publish each other's
  // pair or fail on a rename that already happened.
  const target = join(configDir, tokensFile);
  const staging = `${target}.${randomUUID()}.tmp`;
  // rw------- (owner read/write only)
  try {
    await fs.writeFile(staging, JSON.stringify(tokens, undefined, 2), {
      mode: 0o600,
    });
    await fs.rename(staging, target);
  } catch (err: unknown) {
    // The staging file holds both tokens, whole or in part. Left behind, it
    // outlives the session it was written for; best effort, since whatever
    // refused the write or the rename may refuse the unlink too.
    await fs.unlink(staging).catch(() => {});
    throw err;
  }
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
    // The file is about to become the newer record. A keychain entry left
    // behind would still win on the next load, and its refresh token is
    // spent, so the session would end for no reason. Best effort: a keychain
    // that refuses to write may refuse to delete too.
    try {
      new Entry(service, tokensAccount).deletePassword();
    } catch {
      // nothing more to clear
    }
    await saveToFile(configDir, tokens, fs);
    return { stored: "file", keychainError: errorMessage(err) };
  }
}
