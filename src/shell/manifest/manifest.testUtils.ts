import type { Manifest } from "./types.js";

type ManifestFlow = Manifest["flows"][number];

/** A flow entry with every optional field unset, then `over`. */
export const makeManifestFlow = (
  over: Partial<ManifestFlow> = {},
): ManifestFlow => ({
  path: "src/flows/a.flow.ts",
  contentHash: "hash",
  tags: undefined,
  flowId: undefined,
  ...over,
});

/** A manifest with nothing fetched and no flows, then `over`. */
export const makeManifest = (over: Partial<Manifest> = {}): Manifest => ({
  envId: "env-1",
  envSlug: undefined,
  envName: undefined,
  fetchedAt: "2026-05-10T12:00:00.000Z",
  envVarsFetchedAt: undefined,
  cliFlowsVersion: "0.1.0",
  qawolfCommitSha: undefined,
  qawolfCommittedAt: undefined,
  tagsFetchedAt: undefined,
  flows: [],
  ...over,
});
