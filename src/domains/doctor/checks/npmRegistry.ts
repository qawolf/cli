import { doctorMessages } from "~/core/messages/index.js";
import type { SpawnFn } from "~/shell/spawn.js";

import type { CheckResult } from "~/domains/doctor/types.js";

type NpmRegistryDeps = {
  readonly spawn: SpawnFn;
};

export async function checkNpmRegistry(
  deps: NpmRegistryDeps,
): Promise<CheckResult> {
  const result = await deps.spawn("npm", ["ping"]);

  if (result.exitCode < 0) {
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
