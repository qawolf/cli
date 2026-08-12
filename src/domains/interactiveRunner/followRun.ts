import {
  formatRunLogLine,
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
  type CursorRead,
  createJournalCursor,
  createUnreachableBudget,
} from "./journalCursor.js";
import { journalReadFailure, unreachableFailure } from "./readJournal.js";

const pollIntervalMs = 1_000;

type Settlement =
  | { type: "passed" }
  | { type: "failed"; errorMessage: string | undefined }
  | { type: "unrecognized"; status: string };

function findSettlement(
  entries: readonly { payload: unknown }[],
): Settlement | undefined {
  for (const entry of entries) {
    const settlement = readRunSettlement(entry.payload);
    if (settlement.type !== "settled") continue;
    if (settlement.status === "passed") return { type: "passed" };
    if (settlement.status === "failed") {
      return { errorMessage: settlement.errorMessage, type: "failed" };
    }
    return { status: settlement.status, type: "unrecognized" };
  }
  return undefined;
}

function reportSettlement(
  ctx: AuthCommandContext,
  settlement: Settlement,
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
 * What ends the follow is an entry on `run-status`, never the logs: a run that
 * prints nothing would otherwise never finish, and a run that dies mid-sentence
 * would look like one still working. The logs are the output; the status is the
 * answer.
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
  options: { runId: string; runnerId: string; timeoutSeconds: number },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const readLogs = createJournalCursor(ctx, options.runnerId, {
    runId: options.runId,
    stream: "run-logs",
  });
  const readStatus = createJournalCursor(ctx, options.runnerId, {
    runId: options.runId,
    stream: "run-status",
  });
  const unreachable = createUnreachableBudget(pollIntervalMs);

  const printLogs = async (): Promise<CursorRead> => {
    const logs = await readLogs();
    if (logs.type !== "entries") return logs;
    for (const entry of logs.entries) {
      ctx.ui.stream(entry, formatRunLogLine(entry.payload));
    }
    return logs;
  };

  // Polls rather than a clock: the loop sleeps a known interval between reads,
  // so counting them bounds the follow without making it depend on wall time.
  const maxPolls = Math.max(
    1,
    Math.ceil((options.timeoutSeconds * 1_000) / pollIntervalMs),
  );

  for (let poll = 1; ; poll++) {
    const logs = await printLogs();
    if (logs.type === "failed") return journalReadFailure(logs);

    const status = logs.type === "unreachable" ? logs : await readStatus();
    if (status.type === "failed") return journalReadFailure(status);

    if (logs.type === "unreachable" || status.type === "unreachable") {
      if (unreachable.exhausted()) return { ...unreachableFailure };
    } else {
      unreachable.reset();
      const settlement = findSettlement(status.entries);
      if (settlement !== undefined) {
        // Read the logs once more before reporting: the settling status entry and
        // the run's last lines are appended to different streams, so the status can
        // win the race and stopping here would cut the output off short of the very
        // failure being reported.
        await printLogs();
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
