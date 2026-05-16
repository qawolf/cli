import type { CheckResult, SpawnFn } from "~/doctor/types.js";

type PlaywrightDeps = {
  readonly spawn: SpawnFn;
  readonly playwrightCliPath: string | undefined;
};

export async function checkPlaywright(
  deps: PlaywrightDeps,
): Promise<CheckResult> {
  if (deps.playwrightCliPath === undefined) {
    return {
      name: "playwright",
      status: "fail",
      detail:
        "Could not find Playwright. Run `qawolf flows run` to install it, or run `npm install playwright` in your flow directory.",
    };
  }

  const result = await deps.spawn(deps.playwrightCliPath, ["--version"]);

  if (result.exitCode < 0) {
    return {
      name: "playwright",
      status: "fail",
      detail: "Could not launch Playwright. Try reinstalling the qawolf CLI.",
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
