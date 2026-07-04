import { repoReadinessSuite } from "./repoReadiness.js";
import type { Suite } from "../harness/types.js";

const suites: Record<string, Suite> = {
  [repoReadinessSuite.name]: repoReadinessSuite,
};

/** Looks up a registered suite by name; undefined when unknown. */
export function getSuite(name: string): Suite | undefined {
  return suites[name];
}

/** Every registered suite, in registration order. */
export function allSuites(): Suite[] {
  return Object.values(suites);
}
