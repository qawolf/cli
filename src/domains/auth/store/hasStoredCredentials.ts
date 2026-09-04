import { Entry } from "@napi-rs/keyring";

import type { Fs } from "~/shell/fs.js";
import { loadApiKey } from "./load.js";
import { loadTokens } from "./loadTokens.js";

/**
 * Whether this machine holds a credential at all.
 *
 * Answered from storage alone. `resolveApiKey` cannot stand in for it: that
 * refreshes a browser session over the network, so an offline machine — or a
 * refresh token WorkOS has already rotated away — reads as "nothing stored"
 * while the credentials are still on disk.
 */
export async function hasStoredCredentials(
  configDir: string,
  fs: Pick<Fs, "readFile">,
): Promise<boolean> {
  const deps = { EntryClass: Entry, fs };
  const [apiKey, tokens] = await Promise.all([
    loadApiKey(configDir, deps),
    loadTokens(configDir, deps),
  ]);
  return apiKey.found || tokens.found;
}
