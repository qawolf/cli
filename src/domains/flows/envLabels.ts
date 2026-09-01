import { findPulledEnvDir } from "~/core/repoRelativePath.js";

export function envLabelFor(
  file: string,
  labels: ReadonlyMap<string, string>,
): string | undefined {
  const dir = findPulledEnvDir(file);
  return dir === undefined ? undefined : labels.get(dir);
}

/**
 * Names the environment each flow was pulled from, resolving one label per
 * environment rather than one per flow.
 */
export async function readEnvLabels(
  files: readonly string[],
  readEnvLabel: (envDir: string) => Promise<string>,
): Promise<Map<string, string>> {
  const dirs = new Set(
    files.map(findPulledEnvDir).filter((dir) => dir !== undefined),
  );
  const labels = new Map<string, string>();
  for (const dir of dirs) labels.set(dir, await readEnvLabel(dir));
  return labels;
}
