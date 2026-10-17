import { isRuntimeProvidedEnvVar } from "~/core/runtimeEnvVars.js";

import type { FlowEnvVars } from "./types.js";

/** One variable flows read that the environment does not define. */
export type MissingEnvVar = {
  name: string;
  flowCount: number;
};

/** Aggregates missing variables across flows, excluding runner and OS variables. */
export function findMissingEnvVars(args: {
  byFlow: ReadonlyMap<string, FlowEnvVars>;
  definedNames: ReadonlySet<string>;
}): MissingEnvVar[] {
  const flowCountByName = new Map<string, number>();

  for (const { names } of args.byFlow.values()) {
    for (const name of names) {
      if (args.definedNames.has(name)) continue;
      if (isRuntimeProvidedEnvVar(name)) continue;
      flowCountByName.set(name, (flowCountByName.get(name) ?? 0) + 1);
    }
  }

  // Most-used first, so the line that matters most is the one that survives
  // any truncation downstream.
  return [...flowCountByName]
    .map(([name, flowCount]) => ({ name, flowCount }))
    .sort((a, b) => b.flowCount - a.flowCount || a.name.localeCompare(b.name));
}
