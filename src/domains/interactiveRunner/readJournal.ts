import { type JournalEntry, publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

type JournalWindow = {
  entries: JournalEntry<unknown>[];
  hasUnsearchedHistory: boolean;
  nextSequence: number;
  oldestAvailableSequence: number;
};

/**
 * `unreachable` is its own answer rather than a failure.
 *
 * The contract calls it transient — the runner may still be starting, or be too
 * busy to answer — and says nothing was changed, so retrying is safe. A single
 * read has nothing to do but give up on it; a follow has to keep asking, because
 * the first read of a run lands while the pod is still installing dependencies
 * and starting the browser. Collapsing it into a failure here would decide that
 * for both.
 */
export type JournalReadResult =
  | { type: "read"; value: JournalWindow }
  | { type: "unreachable" }
  | { type: "failed"; error: string; exitCode: number };

export type JournalRequest = {
  runId?: string | undefined;
  sinceSequence?: number | undefined;
  stream: string;
  tail?: number | undefined;
};

/** What a caller with nothing to retry with says about an unreachable runner. */
export const unreachableFailure = {
  error: interactiveRunnerMessages.runnerUnreachable,
  exitCode: exitCodes.network,
} as const;

/** One window of one stream. */
export async function readJournal(
  ctx: AuthCommandContext,
  runnerId: string,
  request: JournalRequest,
): Promise<JournalReadResult> {
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.readJournal,
    {
      id: runnerId,
      stream: request.stream,
      ...(request.runId === undefined ? {} : { runId: request.runId }),
      ...(request.sinceSequence === undefined
        ? {}
        : { sinceSequence: request.sinceSequence }),
      ...(request.tail === undefined ? {} : { tail: request.tail }),
    },
  );
  if (!result.ok) {
    return { error: result.error, exitCode: exitCodes.network, type: "failed" };
  }
  if (result.value.outcome === "runner-unreachable") {
    return { type: "unreachable" };
  }
  return { type: "read", value: result.value };
}
