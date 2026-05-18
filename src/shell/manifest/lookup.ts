import { basename, dirname, relative } from "node:path";

import { readManifest } from "./io.js";
import type { FlowStamp } from "./types.js";

export async function findFlowStamp(
  flowAbsPath: string,
): Promise<FlowStamp | undefined> {
  // Walk up from the flow file looking for an ancestor `<envDir>` whose own
  // parent is `.qawolf`. If we never find one, the flow isn't under a pulled
  // env tree and has no stamp.
  let envDir: string | undefined;
  let current = dirname(flowAbsPath);
  while (current !== dirname(current)) {
    const parent = dirname(current);
    if (basename(parent) === ".qawolf") {
      envDir = current;
      break;
    }
    current = parent;
  }
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
