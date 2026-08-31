import { join } from "node:path";

import { sleep } from "~/core/sleep.js";
import type { Fs } from "~/shell/fs.js";

export const staleAfterMs = 5_000;
export const giveUpAfterMs = 30_000;
const retryEveryMs = 25;

export type WithStoreLock = <Answer>(
  change: () => Promise<Answer>,
) => Promise<Answer>;

export function makeStoreLock(options: {
  directory: string;
  fs: Fs;
  lockPath: string;
}): WithStoreLock {
  const { directory, fs, lockPath } = options;
  const heldSincePath = join(lockPath, "heldSince");

  const readHeldSince = async (): Promise<number | undefined> => {
    const stamp = await fs.readFile(heldSincePath).catch(() => "");
    const heldSince = Number.parseInt(stamp, 10);
    return Number.isNaN(heldSince) ? undefined : heldSince;
  };

  const take = async (): Promise<void> => {
    const giveUpAt = Date.now() + giveUpAfterMs;
    await fs.mkdir(directory, { recursive: true });
    let unstampedSince: number | undefined;

    for (;;) {
      const held = await fs
        .mkdir(lockPath)
        .then(() => true)
        .catch(() => false);
      if (held) {
        await fs.writeFile(heldSincePath, String(Date.now()));
        return;
      }

      const heldSince = await readHeldSince();
      if (heldSince !== undefined) unstampedSince = undefined;
      else unstampedSince ??= Date.now();

      if (
        Date.now() - (heldSince ?? unstampedSince ?? Date.now()) >
        staleAfterMs
      ) {
        await fs.rm(lockPath, { force: true, recursive: true });
        continue;
      }
      if (Date.now() >= giveUpAt) {
        throw Error(
          `Timed out waiting for another qawolf command to release ${lockPath}. Delete it if no other command is running.`,
        );
      }
      await sleep(retryEveryMs);
    }
  };

  return async (change) => {
    await take();
    try {
      return await change();
    } finally {
      await fs.rm(lockPath, { force: true, recursive: true });
    }
  };
}
