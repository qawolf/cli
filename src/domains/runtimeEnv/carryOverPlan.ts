import { pinnedPackages } from "./pinnedPackages.js";

const executorPackageNames = new Set(pinnedPackages.map((p) => p.name));

export type PlanCarryOverArgs = {
  // Package names in the project's own node_modules, scopes expanded.
  present: string[];
  // Package names the fallback install put in the outer hop.
  installed: string[];
};

/**
 * The packages to link from the project's `node_modules` into the outer hop
 * after a fallback install: everything the project physically has that the
 * install did not provide. Pinned executor packages stay out so the managed
 * copies keep winning (prefer-pinned), and npm bookkeeping entries are skipped.
 */
export function planCarryOver(args: PlanCarryOverArgs): string[] {
  const installed = new Set(args.installed);
  return args.present.filter(
    (name) =>
      !name.startsWith(".") &&
      !installed.has(name) &&
      !executorPackageNames.has(name),
  );
}
