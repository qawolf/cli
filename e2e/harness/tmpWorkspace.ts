import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type RuntimeRoot = {
  readonly runtimeDir: string;
  readonly cleanup: () => void;
};

export type TmpProject = {
  readonly projectDir: string;
  readonly env: Record<string, string | undefined>;
  readonly cleanup: () => void;
};

/**
 * One isolated managed-runtime root for a whole suite run, wired via
 * QAWOLF_RUNTIME_DIR so nothing touches the real
 * ~/Library/Application Support/qawolf-nodejs. Shared across every case so the
 * runtime + browser download warms once per channel (the managed runtime keys
 * node vs binary by hash internally). QAWOLF_RUNTIME_DIR points at a subdir so
 * its sibling `<base>-runs` staging dir also lands inside the cleaned-up root.
 */
export function createRuntimeRoot(): RuntimeRoot {
  const root = mkdtempSync(join(tmpdir(), "qawolf-e2e-rt-"));
  const runtimeDir = join(root, "runtime");
  mkdirSync(runtimeDir, { recursive: true });
  return {
    runtimeDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/**
 * A throwaway project dir for one case, sharing the run's managed-runtime dir.
 * `cleanup()` removes only this project tree — the runtime root outlives it.
 */
export function createTmpProject(runtimeDir: string): TmpProject {
  const tmp = mkdtempSync(join(tmpdir(), "qawolf-e2e-"));
  const projectDir = join(tmp, "project");
  mkdirSync(projectDir, { recursive: true });
  return {
    projectDir,
    env: { ...process.env, QAWOLF_RUNTIME_DIR: runtimeDir },
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}
