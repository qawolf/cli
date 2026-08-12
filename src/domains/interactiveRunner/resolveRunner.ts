import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { launchAndRemember } from "./launch.js";
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
  | { type: "resolved"; runnerId: string }
  | { type: "launched"; runnerId: string }
  | { type: "failed"; error: string; exitCode: number };

const runnerIdEnvironmentVariable = "QAWOLF_RUNNER_ID";

/**
 * Flag, then environment, then the workspace's stored default: most explicit
 * wins, and each level is one a caller can see and change.
 */
async function chooseRunnerId(
  runner: string | undefined,
  deps: InteractiveRunnerDeps,
): Promise<string | undefined> {
  if (runner !== undefined) return runner;
  const fromEnvironment = deps.env[runnerIdEnvironmentVariable]?.trim();
  if (fromEnvironment) return fromEnvironment;
  return deps.store.readDefaultRunnerId();
}

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
    const parsed = parseRunnerId(chosen);
    return parsed.ok
      ? { runnerId: parsed.id, type: "resolved" }
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
      error: launched.error,
      exitCode: launched.exitCode,
      type: "failed",
    };
  }
  return { runnerId: launched.value.id, type: "launched" };
}

/** Says so, on stderr, when the runner being driven was just started. */
export function announceRunner(
  ctx: AuthCommandContext,
  resolved: Extract<ResolvedRunner, { type: "launched" | "resolved" }>,
): void {
  if (resolved.type === "launched") {
    ctx.ui.info(
      interactiveRunnerMessages.launchedForCommand(resolved.runnerId),
    );
  }
}
