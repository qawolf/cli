import { join } from "node:path";

import { updateCheckMessages } from "~/core/messages/index.js";
import { isNewerVersion } from "~/core/version.js";
import type { Fs } from "~/shell/fs.js";

const noticeFile = "last-update-notice";

export type UpdateNotifier = {
  /**
   * Announces only if the check already settled on a newer, not-yet-announced
   * version. Never waits on the network; never throws.
   */
  notifyIfOutdated(): Promise<void>;
};

const noopNotifier: UpdateNotifier = {
  notifyIfOutdated: () => Promise.resolve(),
};

/**
 * Starts a background check for a newer published CLI version. Call
 * `notifyIfOutdated` after the command finishes. Wire `renderNotice` to
 * `ui.note` so each output mode formats the notice itself.
 */
export function startUpdateCheck(deps: {
  env: Record<string, string | undefined>;
  currentVersion: string;
  configDir: string;
  fs: Fs;
  fetchLatestVersion: () => Promise<string | undefined>;
  renderNotice: (body: string, title: string) => void;
}): UpdateNotifier {
  if (deps.env["QAWOLF_NO_UPDATE_CHECK"]) {
    return noopNotifier;
  }

  let latest: string | undefined;
  void deps.fetchLatestVersion().then(
    (version) => {
      latest = version;
    },
    () => undefined,
  );

  return {
    async notifyIfOutdated() {
      if (latest === undefined) return;
      if (!isNewerVersion(deps.currentVersion, latest)) return;

      const noticePath = join(deps.configDir, noticeFile);
      try {
        const notified = (await deps.fs.readFile(noticePath)).trim();
        if (notified === latest) return;
      } catch {
        // No notice recorded yet. Fall through and announce.
      }

      try {
        deps.renderNotice(
          updateCheckMessages.body(deps.currentVersion, latest),
          updateCheckMessages.title,
        );
      } catch {
        // The command already finished, and a write can still fail (EPIPE on a
        // closed pipe). Leave the marker unwritten so the next run retries.
        return;
      }

      try {
        await deps.fs.mkdir(deps.configDir, { recursive: true });
        await deps.fs.writeFile(noticePath, `${latest}\n`);
      } catch {
        // Best-effort: worst case the notice repeats next run.
      }
    },
  };
}
