import { doctorMessages } from "~/core/messages/index.js";
import { resolveNpmCommand } from "~/shell/npm.js";
import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

type NpmRegistryDeps = {
  readonly spawn: SpawnFn;
  readonly platform: NodeJS.Platform;
};

export async function checkNpmRegistry(
  deps: NpmRegistryDeps,
): Promise<CheckResult> {
  const { platform } = deps;
  const result = await deps.spawn(resolveNpmCommand(platform), ["ping"], {
    platform,
  });

  // cmd.exe's "command not found" code. win32 runs npm.cmd through cmd.exe,
  // so the spawn itself succeeds and a missing npm surfaces here instead of
  // on the exitCode < 0 path.
  const cmdNotFound = deps.platform === "win32" && result.exitCode === 9009;

  if (result.exitCode < 0 || cmdNotFound) {
    return {
      name: "npm-registry",
      status: "warn",
      detail: doctorMessages.npmRegistry.notInstalled,
    };
  }

  if (result.exitCode !== 0) {
    const detail =
      (result.stderr || result.stdout).split("\n")[0]?.trim() ||
      `npm ping exited ${result.exitCode}`;
    return { name: "npm-registry", status: "warn", detail };
  }

  return { name: "npm-registry", status: "pass" };
}
