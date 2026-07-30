import { doctorMessages } from "~/core/messages/index.js";
import { playwrightCliCandidates } from "~/core/playwrightBins.js";
import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

type PlaywrightDeps = {
  readonly spawn: SpawnFn;
  readonly envDir: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly checkExists: (path: string) => boolean;
};

export async function checkPlaywright(
  deps: PlaywrightDeps,
): Promise<CheckResult> {
  const cliPath = deps.envDir
    ? playwrightCliCandidates(deps.envDir, deps.platform).find(deps.checkExists)
    : undefined;

  if (cliPath === undefined) {
    return {
      name: "playwright",
      status: "fail",
      detail: doctorMessages.playwright.notFound,
    };
  }

  const result = await deps.spawn(cliPath, ["--version"], {
    platform: deps.platform,
  });

  if (result.exitCode < 0) {
    return {
      name: "playwright",
      status: "fail",
      detail: doctorMessages.playwright.launchFailed,
    };
  }

  if (result.exitCode !== 0) {
    const detail =
      (result.stderr || result.stdout).split("\n")[0]?.trim() ||
      `playwright --version exited ${result.exitCode}`;
    return { name: "playwright", status: "fail", detail };
  }

  const version = result.stdout.match(/(\d+\.\d+\.\d+)/)?.[1];
  if (!version) {
    return {
      name: "playwright",
      status: "fail",
      detail: doctorMessages.playwright.versionUnparseable,
    };
  }

  return { name: "playwright", status: "pass", version };
}
