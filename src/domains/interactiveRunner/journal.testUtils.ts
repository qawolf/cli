import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";

import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

/**
 * A fake runner journal: one scripted read per poll, per stream.
 *
 * Scripted rather than modelled because what these tests are about is the
 * sequence of reads a follow makes, and the timing between two streams. Each
 * entry in a stream's script is the payloads that poll answers with; a poll past
 * the end of the script answers empty, which is what a quiet stream does.
 */
export function makeJournal(
  scripts: Record<string, unknown[][]>,
  // What the runner still holds, for the reads where history having been
  // truncated out from under the cursor is the thing under test.
  oldestAvailableSequence: Record<string, number> = {},
): (
  contract: AnyPublicApiContract,
  input: unknown,
) => Promise<PlatformResult<unknown>> {
  const polls: Record<string, number> = {};
  let sequence = 0;

  return (_contract, input) => {
    const stream = (input as { stream: string }).stream;
    const poll = polls[stream] ?? 0;
    polls[stream] = poll + 1;
    const payloads = scripts[stream]?.[poll] ?? [];
    const entries = payloads.map((payload) => {
      sequence += 1;
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
        hasUnsearchedHistory: false,
        nextSequence: sequence,
        oldestAvailableSequence: oldestAvailableSequence[stream] ?? 1,
        outcome: "read",
      },
    });
  };
}
