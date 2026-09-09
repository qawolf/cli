import { isNoEntError } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";
import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { account, credentialsFile, service } from "./constants.js";
import type { DeleteCredentialResult } from "./types.js";

function deleteFromKeychain(): DeleteCredentialResult["keychain"] {
  try {
    new Entry(service, account).deletePassword();
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
    await fs.unlink(join(configDir, credentialsFile));
    return "deleted";
  } catch (err: unknown) {
    // Only a missing file is "not-found". Swallowing a permission or I/O error
    // would let logout report "Credentials removed" over a credential that is
    // still on disk.
    if (isNoEntError(err)) return "not-found";
    throw err;
  }
}

export async function deleteApiKey(
  configDir: string,
  fs: Fs,
): Promise<DeleteCredentialResult> {
  const [keychain, file] = await Promise.all([
    Promise.resolve(deleteFromKeychain()),
    deleteFromFile(configDir, fs),
  ]);
  return { keychain, file };
}
