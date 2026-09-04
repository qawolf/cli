import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { isNoEntError } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";
import {
  account,
  credentialsFile,
  service,
  tokensAccount,
  tokensFile,
} from "./constants.js";

async function fileExists(
  path: string,
  fs: Pick<Fs, "readFile">,
): Promise<boolean> {
  try {
    await fs.readFile(path);
    return true;
  } catch (err: unknown) {
    // Anything other than "missing" means something is there that cannot be
    // read — a truncated write, a permission problem — which logout still has
    // to remove.
    return !isNoEntError(err);
  }
}

function keychainHolds(entryAccount: string): boolean {
  try {
    return Boolean(new Entry(service, entryAccount).getPassword());
  } catch {
    // No usable keychain on this machine, so nothing of ours is in it.
    return false;
  }
}

/**
 * Whether this machine holds a credential at all.
 *
 * Presence, not validity: a payload that will not parse still has to be
 * cleared, so this asks whether the file or the keychain entry is there rather
 * than whether it loads. `resolveApiKey` cannot stand in for either question —
 * it refreshes a browser session over the network, so an offline machine reads
 * as "nothing stored" while the credentials are still on disk.
 */
export async function hasStoredCredentials(
  configDir: string,
  fs: Pick<Fs, "readFile">,
): Promise<boolean> {
  const [apiKeyFile, tokenFile] = await Promise.all([
    fileExists(join(configDir, credentialsFile), fs),
    fileExists(join(configDir, tokensFile), fs),
  ]);

  return (
    apiKeyFile ||
    tokenFile ||
    keychainHolds(account) ||
    keychainHolds(tokensAccount)
  );
}
