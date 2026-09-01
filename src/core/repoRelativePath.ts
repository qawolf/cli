import { basename, dirname, relative } from "node:path";

/**
 * Resolves the `.qawolf/<env>/` directory a pulled flow lives under, or
 * undefined when the flow is not part of a pulled env tree.
 */
export function findPulledEnvDir(flowAbsPath: string): string | undefined {
  // Walk up from the flow file looking for an ancestor whose own parent is
  // `.qawolf`; that ancestor is the env dir.
  let current = dirname(flowAbsPath);
  while (current !== dirname(current)) {
    const parent = dirname(current);
    if (basename(parent) === ".qawolf") return current;
    current = parent;
  }
  return undefined;
}

/**
 * Converts a flow's absolute path to the repo-relative form the platform uses
 * (e.g. `src/flows/checkout/login.flow.ts`).
 *
 * Pulled flows resolve against their env dir, so the `.qawolf/<env>/` prefix
 * never leaks into the result; everything else resolves against `cwd`.
 */
export function toRepoRelativePath(flowAbsPath: string, cwd: string): string {
  const envDir = findPulledEnvDir(flowAbsPath);
  return relative(envDir ?? cwd, flowAbsPath);
}
