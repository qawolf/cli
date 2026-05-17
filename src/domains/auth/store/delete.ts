import { unlink } from "node:fs/promises";
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
): Promise<DeleteApiKeyResult["file"]> {
  try {
    await unlink(join(configDir, credentialsFile));
    return "deleted";
  } catch {
    return "not-found";
  }
}

export async function deleteApiKey(
  configDir: string,
): Promise<DeleteApiKeyResult> {
  const [keychain, file] = await Promise.all([
    Promise.resolve(deleteFromKeychain()),
    deleteFromFile(configDir),
  ]);
  return { keychain, file };
}
