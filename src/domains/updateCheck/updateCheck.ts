import { join } from "node:path";

import { updateCheckMessages } from "~/core/messages/index.js";
import { isNewerVersion } from "~/core/version.js";
import type { Fs } from "~/shell/fs.js";

const noticeFile = "last-update-notice";

export type UpdateNotifier = {
  /**
   * Print the update notice if the background check has already found a
   * newer, not-yet-announced version. Never waits on the network and never
   * throws.
   */
  notifyIfOutdated(): Promise<void>;
};

const noopNotifier: UpdateNotifier = {
  notifyIfOutdated: () => Promise.resolve(),
};

/**
 * Kick off a background check against the npm registry for a newer published
 * CLI version. Call `notifyIfOutdated` after the command finishes: it takes
 * the fetch result only if it already settled, and announces each new version
 * at most once (tracked in a config-dir state file).
 *
 * The notice renders per output mode (clack box, plain stderr lines, or a
 * JSONL diagnostic); `renderNotice` should wire to `ui.note`. No-op when
 * `QAWOLF_NO_UPDATE_CHECK` is set.
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

      deps.renderNotice(
        updateCheckMessages.body(deps.currentVersion, latest),
        updateCheckMessages.title,
      );
      try {
        await deps.fs.mkdir(deps.configDir, { recursive: true });
        await deps.fs.writeFile(noticePath, `${latest}\n`);
      } catch {
        // Best-effort: worst case the notice repeats next run.
      }
    },
  };
}
