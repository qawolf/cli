import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";

import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

/**
 * What one stream answers, poll by poll. A number is `oldestAvailableSequence`
 * for that poll, which is how history truncating out from under a cursor is
 * expressed; `"unreachable"` is the runner failing to answer at all.
 */
export type JournalPoll =
  | unknown[]
  | "unreachable"
  | { payloads: unknown[]; oldestAvailableSequence?: number };

export type JournalOptions = {
  hasUnsearchedHistory?: Record<string, boolean>;
};

/**
 * A fake runner journal: one scripted read per poll, per stream.
 *
 * Scripted rather than modelled because what these tests are about is the
 * sequence of reads a follow makes, and the timing between two streams. Each
 * entry in a stream's script is what that poll answers with; a poll past the end
 * of the script answers empty, which is what a quiet stream does.
 *
 * Sequences are counted per stream rather than shared. Two streams are two
 * independent logs on the runner, so a shared counter would let a test pass that
 * advanced one stream's cursor from the other's `nextSequence` — which is exactly
 * the mistake a follow reading two streams can make.
 */
export function makeJournal(
  scripts: Record<string, JournalPoll[]>,
  options: JournalOptions = {},
): (
  contract: AnyPublicApiContract,
  input: unknown,
) => Promise<PlatformResult<unknown>> {
  const polls: Record<string, number> = {};
  const sequences: Record<string, number> = {};

  return (_contract, input) => {
    const stream = (input as { stream: string }).stream;
    const poll = polls[stream] ?? 0;
    polls[stream] = poll + 1;

    const scripted = scripts[stream]?.[poll] ?? [];
    if (scripted === "unreachable") {
      return Promise.resolve({
        ok: true,
        value: { outcome: "runner-unreachable" },
      });
    }

    const { payloads, oldestAvailableSequence } = Array.isArray(scripted)
      ? { oldestAvailableSequence: undefined, payloads: scripted }
      : scripted;

    const entries = payloads.map((payload) => {
      const sequence = (sequences[stream] ?? 0) + 1;
      sequences[stream] = sequence;
      return {
        payload,
        recordedAt: new Date(sequence * 1000).toISOString(),
        sequence,
      };
    });
    return Promise.resolve({
      ok: true,
      value: {
        entries,
        hasUnsearchedHistory: options.hasUnsearchedHistory?.[stream] ?? false,
        nextSequence: sequences[stream] ?? 0,
        oldestAvailableSequence: oldestAvailableSequence ?? 1,
        outcome: "read",
      },
    });
  };
}
