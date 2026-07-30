import { doctorMessages } from "~/core/messages/index.js";
import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

type PlaywrightDeps = {
  readonly spawn: SpawnFn;
  readonly playwrightCliPath: string | undefined;
  readonly platform: NodeJS.Platform;
};

export async function checkPlaywright(
  deps: PlaywrightDeps,
): Promise<CheckResult> {
  if (deps.playwrightCliPath === undefined) {
    return {
      name: "playwright",
      status: "fail",
      detail: doctorMessages.playwright.notFound,
    };
  }

  const result = await deps.spawn(deps.playwrightCliPath, ["--version"], {
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
