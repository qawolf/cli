import { type JournalEntry, publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

type JournalWindow = {
  entries: JournalEntry<unknown>[];
  nextSequence: number;
  oldestAvailableSequence: number;
};

export type JournalReadResult =
  | { ok: true; value: JournalWindow }
  | { ok: false; error: string; exitCode: number };

export type JournalRequest = {
  runId?: string | undefined;
  sinceSequence?: number | undefined;
  stream: string;
  tail?: number | undefined;
};

/**
 * One window of one stream. `runner-unreachable` becomes a failure here rather
 * than a value the caller has to re-handle at every read site: a journal read
 * changes nothing, so there is exactly one thing to say about it and one code to
 * exit with.
 */
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
    return { error: result.error, exitCode: exitCodes.network, ok: false };
  }
  if (result.value.outcome === "runner-unreachable") {
    return {
      error: interactiveRunnerMessages.runnerUnreachable,
      exitCode: exitCodes.network,
      ok: false,
    };
  }
  return { ok: true, value: result.value };
}
