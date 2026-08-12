import type { JournalEntry } from "@qawolf/api-contracts/v1";

import { countSkippedEntries } from "~/core/interactiveRunner/journal.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";

import { type JournalRequest, readJournal } from "./readJournal.js";

export type CursorRead =
  | { type: "entries"; entries: JournalEntry<unknown>[] }
  | { type: "unreachable" }
  | { type: "failed"; error: string; errorBody?: string; exitCode: number };

/**
 * One stream of one runner's journal, read forwards.
 *
 * Owns the three things every reader of a stream has to get right, so that no
 * reader can get one of them wrong on its own: the cursor only ever moves
 * forwards, `tail` applies to the first read alone, and the truncation warning
 * is only meaningful against a cursor.
 *
 * That last one is why the cursor starts undefined rather than at zero. With no
 * `sinceSequence` the read begins at the oldest entry the runner still holds, so
 * by definition nothing was missed — but asking "how far is the oldest entry
 * ahead of zero?" answers with the whole rotated history of a long-lived runner
 * and reads as a hole in output that has none.
 */
export function createJournalCursor(
  ctx: AuthCommandContext,
  runnerId: string,
  request: JournalRequest,
): () => Promise<CursorRead> {
  let sinceSequence = request.sinceSequence;
  let tail = request.tail;
  let warnedUnsearchedHistory = false;

  return async function read(): Promise<CursorRead> {
    const window = await readJournal(ctx, runnerId, {
      ...request,
      sinceSequence,
      tail,
    });
    if (window.type !== "read") return window;

    if (sinceSequence !== undefined) {
      const skipped = countSkippedEntries(
        sinceSequence,
        window.value.oldestAvailableSequence,
      );
      if (skipped > 0) {
        ctx.ui.warn(
          interactiveRunnerMessages.skippedEntries(request.stream, skipped),
        );
      }
    }

    // Once only: a follow re-reads the same unsearched history on every poll,
    // and a warning repeated once a second says nothing the first did not.
    if (window.value.hasUnsearchedHistory && !warnedUnsearchedHistory) {
      warnedUnsearchedHistory = true;
      ctx.ui.warn(interactiveRunnerMessages.unsearchedHistory(request.stream));
    }

    tail = undefined;
    sinceSequence = Math.max(sinceSequence ?? 0, window.value.nextSequence);
    return { entries: window.value.entries, type: "entries" };
  };
}

/**
 * How long a follow keeps asking a runner that will not answer.
 *
 * A read that comes back `runner-unreachable` is transient by contract, and the
 * first read of a fresh run reliably hits one: the pod is installing npm
 * dependencies and starting a browser. Giving up on the first would report a
 * run that is starting normally as a failed one. Giving up never would hide a
 * pod that was killed without running its shutdown path, which is the one thing
 * `run-status` cannot report.
 */
const unreachableGraceMs = 60_000;

/**
 * Counts consecutive unreachable answers and says when to stop asking. Any
 * reachable answer resets it, so the budget bounds one outage rather than the
 * whole follow.
 */
export function createUnreachableBudget(pollIntervalMs: number): {
  exhausted: () => boolean;
  reset: () => void;
} {
  const limit = Math.ceil(unreachableGraceMs / pollIntervalMs);
  let consecutive = 0;
  return {
    exhausted: () => ++consecutive >= limit,
    reset: () => {
      consecutive = 0;
    },
  };
}
