import type { RunnerIdSource } from "~/core/interactiveRunner/runnerIdSource.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { resolveIdFrom, type ResolvedId } from "~/core/resolveId.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { launchAndRemember } from "./launchAndRemember.js";
import { parseRunnerId } from "./runnerIds.js";

/**
 * Which runner a runner-targeting command means.
 *
 * `launched` rather than `resolved` when the CLI had to start one, because the
 * caller has to be told: the browser it is about to drive is fresh, nothing has
 * been run on it and nothing is signed in. A handler that treated the two the
 * same would leave an agent acting on a page it believes it already set up.
 */
export type ResolvedRunner =
  | ({ type: "resolved" } & TargetedRunner)
  | ({ type: "launched"; url: string } & TargetedRunner)
  | { type: "failed"; error: string; errorBody?: string; exitCode: number };

/** A runner a command can act on, and where its id was named. */
export type TargetedRunner = {
  runnerId: string;
  source: RunnerIdSource;
};

export const runnerIdEnvironmentVariable = "QAWOLF_RUNNER_ID";

const chooseRunnerId = (
  runner: string | undefined,
  deps: InteractiveRunnerDeps,
): Promise<ResolvedId | undefined> =>
  resolveIdFrom({
    env: deps.env,
    environmentVariable: runnerIdEnvironmentVariable,
    given: runner,
    readStored: deps.store.readDefaultRunnerId,
  });

export async function resolveRunner(
  ctx: AuthCommandContext,
  options: {
    autoLaunch: boolean;
    /**
     * What to say when nothing names a runner and none will be launched.
     * Optional because most commands want the plain answer; a command whose next
     * step is more than "launch one" supplies its own.
     */
    noRunnerIdMessage?: string;
    runner: string | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<ResolvedRunner> {
  const chosen = await chooseRunnerId(options.runner, deps);
  if (chosen !== undefined) {
    const parsed = parseRunnerId(chosen.id);
    return parsed.ok
      ? { runnerId: parsed.id, source: chosen.source, type: "resolved" }
      : {
          error: parsed.error,
          exitCode: exitCodes.invalidArgs,
          type: "failed",
        };
  }

  if (!options.autoLaunch) {
    return {
      error: options.noRunnerIdMessage ?? interactiveRunnerMessages.noRunnerId,
      exitCode: exitCodes.invalidArgs,
      type: "failed",
    };
  }

  const launched = await launchAndRemember(
    ctx,
    { id: deps.makeRunnerId(), runnerName: undefined },
    deps,
  );
  if (!launched.ok) {
    return {
      ...failureFields(launched),
      exitCode: launched.exitCode,
      type: "failed",
    };
  }
  return {
    runnerId: launched.value.id,
    source: "launched",
    type: "launched",
    url: launched.value.url,
  };
}

/** Says so, on stderr, when the runner being driven was just started. */
export function announceRunner(
  ctx: AuthCommandContext,
  resolved: Extract<ResolvedRunner, { type: "launched" | "resolved" }>,
): void {
  if (resolved.type === "launched") {
    ctx.ui.info(
      interactiveRunnerMessages.launchedForCommand(
        resolved.runnerId,
        resolved.url,
      ),
    );
  }
}
