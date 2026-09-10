import { flowsMessages } from "~/core/messages/index.js";
import type { Fs } from "~/shell/fs.js";

import type { TrpcClient } from "./createTrpcClient.js";
import type { IdentityResponse } from "./getIdentity.js";
import type { PlatformResult } from "./requestWithRetry.js";
import { listTeamStorageFiles } from "./teamStorage.js";
import {
  downloadTeamStorageAssets,
  type SyncTeamStorageAssetsResult,
} from "./teamStorageAssets.js";
import type { TeamStorageFile } from "./types.js";
import type { TeamStorageAssetProgress } from "./writeAssetSnapshot.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
  sleep?: (ms: number) => Promise<void>;
  /** Workspace the session chose; a workspace is a team. */
  workspaceId?: string | undefined;
};

export type TeamStorageMethods = {
  listTeamStorageFiles: () => Promise<PlatformResult<TeamStorageFile[]>>;
  syncTeamStorageAssets: (
    assetsAbs: string,
    opts?: { onProgress?: (progress: TeamStorageAssetProgress) => void },
  ) => Promise<PlatformResult<SyncTeamStorageAssetsResult>>;
};

/**
 * Reading the team's shared files, and mirroring them into the local assets
 * directory.
 *
 * Both need a team id, which reaches this in one of two ways: a browser session
 * chose a workspace, or the credential is itself team-scoped.
 */
export function createTeamStorageMethods(
  trpc: TrpcClient,
  deps: Deps,
  fs: Fs,
  getIdentity: () => Promise<PlatformResult<IdentityResponse>>,
): TeamStorageMethods {
  async function list(): Promise<PlatformResult<TeamStorageFile[]>> {
    // A workspace is a team, so a browser session that chose one already names
    // the team this route wants. Preferred over the identity probe because a
    // browser session's identity carries an organization and no team at all —
    // reading it first refused every such session before it reached the API.
    if (deps.workspaceId !== undefined) {
      return listTeamStorageFiles(trpc, { teamId: deps.workspaceId }, deps);
    }

    const identity = await getIdentity();
    if (!identity.ok) return identity;
    // No workspace to fall back on: an organization-scoped API key reaches many
    // teams and names none, so team storage is genuinely out of reach.
    if (!("team" in identity.value)) {
      return {
        ok: false,
        error: flowsMessages.pull.teamStorageRequiresTeamKey,
      };
    }
    return listTeamStorageFiles(trpc, { teamId: identity.value.team.id }, deps);
  }

  return {
    listTeamStorageFiles: list,

    async syncTeamStorageAssets(assetsAbs, opts) {
      const files = await list();
      if (!files.ok) return files;
      return downloadTeamStorageAssets(
        { assetsAbs, files: files.value },
        { fetch: deps.fetch, fs, onProgress: opts?.onProgress },
      );
    },
  };
}
