import { Entry } from "@napi-rs/keyring";

import type { Fs } from "~/shell/fs.js";
import { makeOauthDeps } from "./resolve.js";
import { type OauthToken, resolveOauthToken } from "./resolveOauthToken.js";
import { loadTokens as realLoadTokens } from "./store/loadTokens.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

export type RefreshStoredSessionDeps = {
  loadTokens: (configDir: string) => Promise<LoadTokensResult>;
  resolveOauth: (configDir: string) => Promise<OauthToken | undefined>;
};

export type RefreshStoredSessionResult =
  | { kind: "session"; session: StoredSession }
  | { kind: "not-signed-in" }
  | { kind: "refresh-failed" };

function makeDefaultDeps(fs: Fs): RefreshStoredSessionDeps {
  return {
    loadTokens: (configDir) =>
      realLoadTokens(configDir, { EntryClass: Entry, fs }),
    resolveOauth: (configDir) =>
      resolveOauthToken(configDir, makeOauthDeps(fs)),
  };
}

/**
 * The stored browser session, renewed if its access token is spent.
 *
 * `resolveApiKey` is not the way in here: it prefers a stored API key, so it
 * would hand back the wrong credential. Loading the session directly is not
 * either — a stored access token lasts minutes, so presenting one unrenewed
 * reports a perfectly good session as an invalid credential.
 */
export async function refreshStoredSession(
  configDir: string,
  fs: Fs,
  deps?: RefreshStoredSessionDeps,
): Promise<RefreshStoredSessionResult> {
  const resolvedDeps = deps ?? makeDefaultDeps(fs);

  const before = await resolvedDeps.loadTokens(configDir);
  if (!before.found) return { kind: "not-signed-in" };

  const renewed = await resolvedDeps.resolveOauth(configDir);
  if (!renewed) return { kind: "refresh-failed" };

  // Read back rather than reusing the copy from above: a refresh rotates the
  // token pair and persists it, so the loaded copy is already spent. Handing
  // that stale pair to a later save would write the dead refresh token back and
  // sign the person out on their next command.
  const after = await resolvedDeps.loadTokens(configDir);
  if (!after.found) return { kind: "refresh-failed" };

  // The reread has to be the pair the refresh just produced. The store is
  // shared, so a sign-in that landed between the two reads is someone else's
  // session; and a refresh whose write failed leaves the spent pair on disk.
  // Choosing a workspace on either would write this command's choice into a
  // session it does not own, or onto a refresh token that is already dead.
  if (after.tokens.accessToken !== renewed.key) {
    return { kind: "refresh-failed" };
  }

  return { kind: "session", session: after.tokens };
}
