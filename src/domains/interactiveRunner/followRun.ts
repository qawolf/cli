import {
  type SettledRun,
  findSettlement,
  readRunSettlement,
} from "~/core/interactiveRunner/journal.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import {
  type FollowStreamOptions,
  createFollowPrinters,
} from "./followPrinters.js";
import {
  type CursorRead,
  createJournalCursor,
  createUnreachableBudget,
} from "./journalCursor.js";
import { journalReadFailure, unreachableFailure } from "./readJournal.js";

const pollIntervalMs = 1_000;

function reportSettlement(
  ctx: AuthCommandContext,
  settlement: SettledRun,
): CommandResult {
  if (settlement.type === "passed") {
    ctx.ui.success(interactiveRunnerMessages.runPassed);
    return undefined;
  }
  return {
    error:
      settlement.type === "failed"
        ? interactiveRunnerMessages.runFailed(settlement.errorMessage)
        : interactiveRunnerMessages.runSettledUnknown(settlement.status),
    exitCode: exitCodes.testFailure,
  };
}

/**
 * Follows a run to its end.
 *
 * What the follow prints is the flags' choice: only the run's `run-status`
 * events — in progress, passed, failed — by default, plus whichever mirror
 * streams were asked for (see {@link createFollowPrinters}). What ends the
 * follow is an entry on `run-status` either way, never the mirrors: a run that
 * prints nothing would otherwise never finish, and a run that dies mid-sentence
 * would look like one still working. The mirrors are the output; the status is
 * the answer.
 *
 * A runner that stops answering for long enough ends the follow too, as a
 * failure. `run-status` cannot cover a runner killed without running its
 * shutdown path, so a persistently unreachable runner is the only signal that
 * such a run is over. One unreachable answer is not that signal — see
 * {@link createUnreachableBudget}.
 *
 * `timeoutSeconds` bounds the whole follow, because a journal read counts as
 * activity: polling a runner is what stops it being reaped for inactivity, so a
 * run that never settles would have the follow keep its pod alive and billing
 * for as long as the terminal stayed open.
 */
export async function followRun(
  ctx: AuthCommandContext,
  options: FollowStreamOptions & { timeoutSeconds: number },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const printers = createFollowPrinters(ctx, options);
  const readStatus = createJournalCursor(ctx, options.runnerId, {
    runId: options.runId,
    stream: "run-status",
  });
  const unreachable = createUnreachableBudget(pollIntervalMs);

  /** Undefined when every printer read cleanly; the interrupting read if not. */
  const printAll = async (): Promise<CursorRead | undefined> => {
    for (const print of printers) {
      const window = await print();
      if (window.type !== "entries") return window;
    }
    return undefined;
  };

  // The in-progress line is for the otherwise-silent follow: any mirror stream
  // already shows life, and prose among its JSON lines would hurt a parser. The
  // runner may also write `in-progress` again (a heartbeat, a retry); the quiet
  // follow reports it once.
  let progressReported = false;
  const printProgress = (entries: readonly { payload: unknown }[]): void => {
    if (printers.length > 0 || progressReported) return;
    const entry = entries.find(
      (e) => readRunSettlement(e.payload).type === "in-progress",
    );
    if (entry === undefined) return;
    progressReported = true;
    ctx.ui.stream(entry, interactiveRunnerMessages.runInProgress);
  };

  // Polls rather than a clock: the loop sleeps a known interval between reads,
  // so counting them bounds the follow without making it depend on wall time.
  const maxPolls = Math.max(
    1,
    Math.ceil((options.timeoutSeconds * 1_000) / pollIntervalMs),
  );

  for (let poll = 1; ; poll++) {
    const interrupted = await printAll();
    if (interrupted?.type === "failed") return journalReadFailure(interrupted);

    const status =
      interrupted?.type === "unreachable" ? interrupted : await readStatus();
    if (status.type === "failed") return journalReadFailure(status);

    if (status.type === "unreachable") {
      if (unreachable.exhausted()) return { ...unreachableFailure };
    } else {
      unreachable.reset();
      printProgress(status.entries);
      const settlement = findSettlement(status.entries);
      if (settlement !== undefined) {
        // Read the mirrors once more before reporting: the settling status entry
        // and the run's last lines are appended to different streams, so the
        // status can win the race and stopping here would cut the output off
        // short of the very failure being reported. A warning rather than a
        // failure when this read does not answer: the settlement is known, and
        // the run's outcome must not be overridden by a flush of its output.
        if ((await printAll()) !== undefined) {
          ctx.ui.warn(interactiveRunnerMessages.followEndCutShort);
        }
        return reportSettlement(ctx, settlement);
      }
    }

    if (poll >= maxPolls) {
      return {
        error: interactiveRunnerMessages.followTimedOut(
          options.runId,
          options.runnerId,
          options.timeoutSeconds,
        ),
        exitCode: exitCodes.timeout,
      };
    }
    await deps.sleep(pollIntervalMs);
  }
}
