import { doctorMessages } from "~/core/messages/index.js";
import {
  playwrightCliInvocation,
  playwrightCliJsPath,
} from "~/core/playwrightCli.js";
import { playwrightVersion } from "~/generated/dependencyVersions.js";
import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

type PlaywrightDeps = {
  readonly spawn: SpawnFn;
  readonly execPath: string;
  readonly envDir: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly checkExists: (path: string) => boolean;
};

export async function checkPlaywright(
  deps: PlaywrightDeps,
): Promise<CheckResult> {
  const { envDir } = deps;
  const cliJsPath =
    envDir === undefined ? undefined : playwrightCliJsPath(envDir);

  if (
    envDir === undefined ||
    cliJsPath === undefined ||
    !deps.checkExists(cliJsPath)
  ) {
    return {
      name: "playwright",
      status: "fail",
      detail: doctorMessages.playwright.notFound(cliJsPath),
    };
  }

  const invocation = playwrightCliInvocation({
    envDir,
    execPath: deps.execPath,
    cliArgs: ["--version"],
  });
  const result = await deps.spawn(invocation.cmd, invocation.args, {
    platform: deps.platform,
    env: invocation.env,
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

  // A version other than the pin means the env dir resolves a playwright the
  // flow runtime was not built against — browser builds will not line up.
  if (version !== playwrightVersion) {
    return {
      name: "playwright",
      status: "fail",
      version,
      detail: doctorMessages.playwright.versionMismatch(
        version,
        playwrightVersion,
      ),
    };
  }

  return { name: "playwright", status: "pass", version };
}
