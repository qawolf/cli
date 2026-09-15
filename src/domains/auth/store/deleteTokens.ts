import { isNoEntError } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";
import { loadEntryClass } from "~/shell/keyring.js";
import { join } from "node:path";

import { service, tokensAccount, tokensFile } from "./constants.js";
import type { DeleteCredentialResult } from "./types.js";

async function deleteFromKeychain(): Promise<
  DeleteCredentialResult["keychain"]
> {
  try {
    const Entry = await loadEntryClass();
    new Entry(service, tokensAccount).deletePassword();
    return "deleted";
  } catch {
    return "unavailable";
  }
}

async function deleteFromFile(
  configDir: string,
  fs: Fs,
): Promise<DeleteCredentialResult["file"]> {
  try {
    await fs.unlink(join(configDir, tokensFile));
    return "deleted";
  } catch (err: unknown) {
    // Only a missing file is "not-found". Swallowing a permission or I/O error
    // would let logout report "Credentials removed" over a credential that is
    // still on disk.
    if (isNoEntError(err)) return "not-found";
    throw err;
  }
}

export async function deleteTokens(
  configDir: string,
  fs: Fs,
): Promise<DeleteCredentialResult> {
  const [keychain, file] = await Promise.all([
    deleteFromKeychain(),
    deleteFromFile(configDir, fs),
  ]);
  return { keychain, file };
}
