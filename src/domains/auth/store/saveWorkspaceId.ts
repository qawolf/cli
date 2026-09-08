import type { Fs } from "~/shell/fs.js";
import { Entry } from "@napi-rs/keyring";

import { authMessages } from "~/core/messages/index.js";
import type { LoadTokensResult, StoredSession } from "~/domains/auth/types.js";
import { loadTokens } from "./loadTokens.js";
import { saveTokens } from "./saveTokens.js";
import type { SaveCredentialResult } from "./types.js";

export type SaveWorkspaceIdDeps = {
  loadTokens: () => Promise<LoadTokensResult>;
  saveTokens: (session: StoredSession) => Promise<SaveCredentialResult>;
};

export function makeSaveWorkspaceIdDeps(
  configDir: string,
  fs: Fs,
): SaveWorkspaceIdDeps {
  return {
    loadTokens: () => loadTokens(configDir, { EntryClass: Entry, fs }),
    saveTokens: (session) => saveTokens(configDir, session, fs),
  };
}

/**
 * Records the chosen workspace against the session that is stored now, rather
 * than against the copy the command read when it started.
 *
 * Choosing waits on a person, and a renewal in another process rotates the
 * pair while they think. Writing the captured copy back would restore a
 * refresh token that is already spent, which ends the session on the next
 * command for no reason the person can see.
 */
export async function saveWorkspaceId(
  session: StoredSession,
  workspaceId: string,
  deps: SaveWorkspaceIdDeps,
): Promise<SaveCredentialResult> {
  const current = await deps.loadTokens();

  // A different account, or none at all, is a different session: the choice
  // was made against a list this credential may not even reach, so there is
  // nowhere honest to put it.
  if (!current.found || !isSameSession(current.tokens, session)) {
    throw Error(authMessages.workspace.sessionChanged);
  }

  return deps.saveTokens({ ...current.tokens, workspaceId });
}

/**
 * Identity, not tokens. A renewal rotates the pair without changing who is
 * signed in, and that is the case this must not refuse.
 */
function isSameSession(
  stored: StoredSession,
  captured: StoredSession,
): boolean {
  return (
    stored.email === captured.email &&
    stored.organizationId === captured.organizationId
  );
}
