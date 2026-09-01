import { relative } from "node:path";

import { findPulledEnvDir } from "~/core/repoRelativePath.js";
import { readManifest } from "./io.js";
import type { FlowStamp } from "./types.js";

export async function findFlowStamp(
  flowAbsPath: string,
): Promise<FlowStamp | undefined> {
  // No env dir means the flow isn't under a pulled env tree and has no stamp.
  const envDir = findPulledEnvDir(flowAbsPath);
  if (!envDir) return undefined;

  const manifest = await readManifest(envDir);
  if (typeof manifest === "string") return undefined;

  const relPath = relative(envDir, flowAbsPath);
  const entry = manifest.flows.find((f) => f.path === relPath);
  if (!entry) return undefined;

  return {
    envId: manifest.envId,
    path: entry.path,
    contentHash: entry.contentHash,
  };
}
