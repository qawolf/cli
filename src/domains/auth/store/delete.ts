import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import { join } from "node:path";

import { Entry } from "@napi-rs/keyring";

import { account, credentialsFile, service } from "./constants.js";
import type { DeleteApiKeyResult } from "./types.js";

function deleteFromKeychain(): DeleteApiKeyResult["keychain"] {
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
): Promise<DeleteApiKeyResult["file"]> {
  try {
    await fs.unlink(join(configDir, credentialsFile));
    return "deleted";
  } catch {
    return "not-found";
  }
}

export async function deleteApiKey(
  configDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<DeleteApiKeyResult> {
  const [keychain, file] = await Promise.all([
    Promise.resolve(deleteFromKeychain()),
    deleteFromFile(configDir, fs),
  ]);
  return { keychain, file };
}
