import { formatRunLogLine } from "~/core/interactiveRunner/journal.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";

import {
  type CursorRead,
  createPrintingCursor,
  createUnreachableBudget,
} from "./journalCursor.js";
import {
  journalReadFailure,
  readJournal,
  unreachableFailure,
} from "./readJournal.js";

const anchorPollIntervalMs = 1_000;

type RecorderAnchor =
  | { ok: true; sinceSequence: number }
  | { ok: false; failure: ReturnType<typeof journalReadFailure> };

/**
 * Where "this run's recorder events" begin: the recorder journal's current end.
 * Taken before the run is submitted, so the anchor cannot sit past the run's
 * first events. A runner this command just launched has a provably empty
 * journal, so asking it would only wait out its boot for a knowable answer;
 * only a reused runner is read.
 *
 * TODO NOVA-1546: the anchor exists because recorder payloads carry no runId;
 * once the platform stamps them, a run filter replaces all of this.
 */
export async function resolveRecorderAnchor(
  ctx: AuthCommandContext,
  resolved: { runnerId: string; type: "launched" | "resolved" },
  deps: { sleep: (ms: number) => Promise<void> },
): Promise<RecorderAnchor> {
  if (resolved.type === "launched") return { ok: true, sinceSequence: 0 };
  return anchorRecorderCursor(ctx, resolved.runnerId, deps);
}

/**
 * An unreachable runner is retried on the follow's own grace, never guessed at:
 * unreachable can mean a reused runner too busy to answer, and anchoring one at
 * zero would replay its whole recorder history as this run's actions. A runner
 * that never answers fails the command here, before anything is submitted and
 * billed.
 */
async function anchorRecorderCursor(
  ctx: AuthCommandContext,
  runnerId: string,
  deps: { sleep: (ms: number) => Promise<void> },
): Promise<RecorderAnchor> {
  const unreachable = createUnreachableBudget(anchorPollIntervalMs);
  for (;;) {
    const anchor = await readJournal(ctx, runnerId, {
      stream: "recorder",
      tail: 1,
    });
    if (anchor.type === "read") {
      return { ok: true, sinceSequence: anchor.value.nextSequence };
    }
    if (anchor.type === "failed") {
      return { failure: journalReadFailure(anchor), ok: false };
    }
    if (unreachable.exhausted()) {
      return { failure: { ...unreachableFailure }, ok: false };
    }
    await deps.sleep(anchorPollIntervalMs);
  }
}

export type FollowStreamOptions = {
  logs: boolean;
  /**
   * Where in the `recorder` stream this run's events begin, or undefined to not
   * follow it. An anchor rather than a run filter, because recorder entries
   * carry no `runId` — the recorder outlives runs, so "this run's recorder
   * events" can only mean "recorded after this point".
   */
  recorderSinceSequence: number | undefined;
  runEvents: boolean;
  runId: string;
  runnerId: string;
};

/**
 * The mirror streams a follow prints beside `run-status`, one printing cursor
 * per stream a flag asked for. Log lines print as their message; the event
 * streams print each payload as one JSON line, the same rendering
 * `qawolf runner events` gives them.
 */
export function createFollowPrinters(
  ctx: AuthCommandContext,
  options: FollowStreamOptions,
): (() => Promise<CursorRead>)[] {
  const jsonLine = (payload: unknown) => JSON.stringify(payload);
  const printers: (() => Promise<CursorRead>)[] = [];
  if (options.logs) {
    printers.push(
      createPrintingCursor(
        ctx,
        options.runnerId,
        { runId: options.runId, stream: "run-logs" },
        formatRunLogLine,
      ),
    );
  }
  if (options.runEvents) {
    printers.push(
      createPrintingCursor(
        ctx,
        options.runnerId,
        { runId: options.runId, stream: "run-events" },
        jsonLine,
      ),
    );
  }
  if (options.recorderSinceSequence !== undefined) {
    printers.push(
      createPrintingCursor(
        ctx,
        options.runnerId,
        { sinceSequence: options.recorderSinceSequence, stream: "recorder" },
        jsonLine,
      ),
    );
  }
  return printers;
}
