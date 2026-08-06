import {
  countSkippedEntries,
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
import { readJournal } from "./readJournal.js";

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
 * A pod that stops answering ends the follow too, as a failure. `run-status`
 * cannot cover a runner killed without running its shutdown path, so the runner
 * becoming unreachable is the only signal that such a run is over.
 */
export async function followRun(
  ctx: AuthCommandContext,
  options: { runId: string; runnerId: string },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  let logsSequence = 0;
  let statusSequence = 0;

  const drainLogs = async (): Promise<
    { ok: true } | { ok: false; error: string; exitCode: number }
  > => {
    const logs = await readJournal(ctx, options.runnerId, {
      runId: options.runId,
      sinceSequence: logsSequence,
      stream: "run-logs",
    });
    if (!logs.ok) return logs;

    const skipped = countSkippedEntries(
      logsSequence,
      logs.value.oldestAvailableSequence,
    );
    if (skipped > 0) {
      ctx.ui.warn(
        interactiveRunnerMessages.skippedEntries("run-logs", skipped),
      );
    }

    for (const entry of logs.value.entries) {
      ctx.ui.stream(entry, formatRunLogLine(entry.payload));
    }
    // Never backwards, so a cursor that moved back cannot make the follow
    // reprint the same lines once a second for as long as the run lasts.
    logsSequence = Math.max(logsSequence, logs.value.nextSequence);
    return { ok: true };
  };

  for (;;) {
    const drained = await drainLogs();
    if (!drained.ok)
      return { error: drained.error, exitCode: drained.exitCode };

    const status = await readJournal(ctx, options.runnerId, {
      runId: options.runId,
      sinceSequence: statusSequence,
      stream: "run-status",
    });
    if (!status.ok) return { error: status.error, exitCode: status.exitCode };
    statusSequence = Math.max(statusSequence, status.value.nextSequence);

    const settlement = findSettlement(status.value.entries);
    if (settlement !== undefined) {
      // Read the logs once more before reporting: the settling status entry and
      // the run's last lines are appended to different streams, so the status can
      // win the race and stopping here would cut the output off short of the very
      // failure being reported.
      await drainLogs();
      return reportSettlement(ctx, settlement);
    }

    await deps.sleep(pollIntervalMs);
  }
}
