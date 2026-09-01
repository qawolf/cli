import { findPulledEnvDir } from "~/core/repoRelativePath.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { SelectFn } from "~/shell/ui/renderers/select.js";

/** Sentinel for the "every environment" option, which is not an env dir. */
const allValue = "all";

export type EnvChoice =
  | { kind: "proceed"; files: string[] }
  | { kind: "error"; error: string }
  | { kind: "cancelled" };

type Args = {
  readonly files: readonly string[];
  /** Set by --all-envs: the non-interactive equivalent of choosing All. */
  readonly allEnvs: boolean;
  readonly mode: OutputMode;
  readonly select: SelectFn;
  /** Human label for a pulled env dir — its slug, name, or id. */
  readonly readLabel: (envDir: string) => Promise<string>;
};

/**
 * Decides which environment's copies to act on when a selection matches flows
 * in more than one pulled environment.
 *
 * Each env has its own variables, so the copies are different runs of the same
 * file rather than duplicates. Choosing silently would be a guess, so a human
 * is asked and everyone else gets the same choices as an error.
 */
export async function resolveEnvChoice(args: Args): Promise<EnvChoice> {
  const byEnv = new Map<string, string[]>();
  for (const file of args.files) {
    // Project flows share one bucket: they belong to no pulled env, so they
    // never make a selection ambiguous.
    const key = findPulledEnvDir(file) ?? "";
    const group = byEnv.get(key);
    if (group) group.push(file);
    else byEnv.set(key, [file]);
  }

  const envDirs = [...byEnv.keys()].filter((key) => key !== "");
  if (envDirs.length <= 1 || args.allEnvs) {
    return { kind: "proceed", files: [...args.files] };
  }

  const labels = await Promise.all(
    envDirs.map(async (dir) => ({ dir, label: await args.readLabel(dir) })),
  );

  if (args.mode !== "human") {
    return {
      kind: "error",
      error: flowsMessages.selectors.ambiguousEnvs(labels.map((l) => l.label)),
    };
  }

  const picked = await args.select(flowsMessages.selectors.chooseEnv, [
    ...labels.map(({ dir, label }) => ({ value: dir, label })),
    { value: allValue, label: "All" },
  ]);
  if (!picked.ok) return { kind: "cancelled" };
  if (picked.value === allValue) {
    return { kind: "proceed", files: [...args.files] };
  }
  // Project flows belong to no environment, so choosing one must not drop
  // them: they were never part of the ambiguity.
  return {
    kind: "proceed",
    files: [...(byEnv.get("") ?? []), ...(byEnv.get(picked.value) ?? [])],
  };
}
