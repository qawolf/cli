import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import {
  ensureRuntimeEnv,
  type EnsureRuntimeEnvResult,
} from "~/domains/runtimeEnv/index.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";

export type ResolveDepsRootArgs = {
  files: string[];
  overrideDir?: string;
  fs?: Fs;
};

/**
 * Resolves the dependency root for a set of flow files: finds the project
 * package dir (best-effort — multi-package patterns fall back to the managed
 * dir) and hands off to ensureRuntimeEnv. The single entry every command uses
 * so override / project / managed resolution stays identical across them.
 */
export function resolveDepsRoot(
  args: ResolveDepsRootArgs,
): Promise<EnsureRuntimeEnvResult> {
  const fs = args.fs ?? makeDefaultFs();
  let projectDir: string | undefined;
  try {
    projectDir = resolveUniqueEnvDir(args.files, fs);
  } catch {
    projectDir = undefined;
  }
  return ensureRuntimeEnv(
    {
      ...(projectDir !== undefined ? { projectDir } : {}),
      ...(args.overrideDir !== undefined
        ? { overrideDir: args.overrideDir }
        : {}),
    },
    { fs },
  );
}
