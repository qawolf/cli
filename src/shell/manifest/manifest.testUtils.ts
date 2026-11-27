import type { Manifest } from "./types.js";

type ManifestFlow = Manifest["flows"][number];

/** A flow entry with every optional field unset, then `over`. */
export const makeManifestFlow = (
  over: Partial<ManifestFlow> = {},
): ManifestFlow => ({
  path: "src/flows/a.flow.ts",
  contentHash: "hash",
  tags: undefined,
  envVars: undefined,
  envVarsMayBeIncomplete: undefined,
  ...over,
});
