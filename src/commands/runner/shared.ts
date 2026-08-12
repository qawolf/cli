import { makeInteractiveRunnerDeps } from "~/domains/interactiveRunner/deps.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";

export const runnerFlagDescription =
  "Runner to target. Defaults to QAWOLF_RUNNER_ID, then this directory's stored runner";

export function deps(
  ctx: AuthCommandContext,
): ReturnType<typeof makeInteractiveRunnerDeps> {
  return makeInteractiveRunnerDeps({
    cwd: process.cwd(),
    env: process.env,
    fs: ctx.fs,
  });
}
