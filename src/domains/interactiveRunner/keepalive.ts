import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { readJournal, unreachableFailure } from "./readJournal.js";
import { resolveRunner } from "./resolveRunner.js";

/**
 * Resets the runner's inactivity clock, for a harness that thinks for minutes
 * between actions.
 *
 * There is no keepalive endpoint, and this command does not want one: the
 * published contract for `runner.readJournal` promises that "a read counts as
 * activity, so working through history does not get the runner reaped underneath
 * you". A bounded read is therefore the whole implementation; what it buys a
 * caller is not having to know which of the verbs happens to count.
 *
 * `run-status` with `tail: 1` because a tail read seeks from the end rather than
 * scanning the file, so the cheapest read available is also one that says
 * something: it answers `runner-unreachable` when the clock could not be reset
 * because there is no longer a runner to reset it on.
 *
 * Never launches. A caller asking to keep a runner alive has one in mind, and
 * starting a fresh one instead would answer a question nobody asked.
 */
export async function handleRunnerKeepalive(
  ctx: AuthCommandContext,
  options: { runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: false, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { error: resolved.error, exitCode: resolved.exitCode };
  }

  const window = await readJournal(ctx, resolved.runnerId, {
    stream: "run-status",
    tail: 1,
  });
  // One read, so an unreachable runner is the answer rather than something to
  // wait out: the clock could not be reset because there is no runner to reset.
  if (window.type === "unreachable") return { ...unreachableFailure };
  if (window.type === "failed") return window;

  ctx.ui.output(
    { id: resolved.runnerId, outcome: "alive" },
    interactiveRunnerMessages.keptAlive(resolved.runnerId),
  );
  return undefined;
}
