import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Tracks temp dirs created by a test file so afterEach can remove them. */
export type TmpDirTracker = {
  makeTmpDir(): Promise<string>;
  track(dir: string): void;
  cleanup(): Promise<void>;
};

export function makeTmpDirTracker(prefix: string): TmpDirTracker {
  const dirs: string[] = [];
  return {
    async makeTmpDir() {
      const d = realpathSync(await mkdtemp(join(tmpdir(), prefix)));
      dirs.push(d);
      return d;
    },
    track(dir) {
      dirs.push(dir);
    },
    async cleanup() {
      // Reverse creation order, one at a time: a later dir can hold a junction
      // into an earlier one, and win32 fails to remove a junction whose target
      // is already gone.
      for (const d of [...dirs].reverse()) {
        await rm(d, { recursive: true, force: true });
      }
      dirs.length = 0;
    },
  };
}
