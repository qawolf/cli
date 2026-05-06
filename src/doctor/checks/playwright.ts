import type { CheckResult, SpawnFn } from "~/doctor/types.js";

type PlaywrightDeps = {
  readonly spawn: SpawnFn;
};

// TODO WIZ-10341: match against a Playwright dep pin once present.
export async function checkPlaywright(
  deps: PlaywrightDeps,
): Promise<CheckResult> {
  const result = await deps.spawn("playwright", ["--version"]);

  if (result.exitCode < 0) {
    return {
      name: "playwright",
      status: "fail",
      detail: "playwright is not installed or not on PATH",
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
      detail: "Could not parse playwright version output",
    };
  }

  return { name: "playwright", status: "pass" };
}
