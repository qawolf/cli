import {
  journalStreamSchema,
  knownJournalStreams,
  readJournalRequestSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { formatJournalLine } from "~/core/interactiveRunner/journal.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import {
  createJournalCursor,
  createUnreachableBudget,
} from "./journalCursor.js";
import { unreachableFailure } from "./readJournal.js";
import { resolveRunner } from "./resolveRunner.js";

const pollIntervalMs = 1_000;

export type RunnerEventsOptions = {
  envelope: boolean;
  follow: boolean;
  run: string | undefined;
  runner: string | undefined;
  since: string | undefined;
  stream: string;
  tail: string | undefined;
};

const countSchema = z.coerce.number().int().positive();
const sequenceSchema = z.coerce.number().int().nonnegative();

type ParsedOptions = {
  runId: string | undefined;
  sinceSequence: number | undefined;
  stream: string;
  tail: number | undefined;
};

function parseOptions(
  options: RunnerEventsOptions,
): { ok: true; value: ParsedOptions } | { ok: false; error: string } {
  const parsed = z
    .object({
      // A run id is a path segment on the runner just as a stream name is, so it
      // is held to the published bound rather than passed through unchecked.
      run: readJournalRequestSchema.shape.runId,
      since: sequenceSchema.optional(),
      stream: journalStreamSchema,
      tail: countSchema.optional(),
    })
    .safeParse({
      stream: options.stream,
      ...(options.run === undefined ? {} : { run: options.run }),
      ...(options.since === undefined ? {} : { since: options.since }),
      ...(options.tail === undefined ? {} : { tail: options.tail }),
    });
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return {
    ok: true,
    value: {
      runId: parsed.data.run,
      sinceSequence: parsed.data.since,
      stream: parsed.data.stream,
      tail: parsed.data.tail,
    },
  };
}

/**
 * Prints one stream of a runner's journal, one entry per line.
 *
 * `--follow` polls the cursor the previous read handed back rather than holding a
 * connection, which is the same code path as a plain read and works from a
 * sandbox that can only make requests. `tail` applies to the first read only:
 * afterwards there is a cursor, and re-applying a tail would skip entries that
 * arrived between polls.
 */
export async function handleRunnerEvents(
  ctx: AuthCommandContext,
  options: RunnerEventsOptions,
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const parsed = parseOptions(options);
  if (!parsed.ok)
    return { error: parsed.error, exitCode: exitCodes.invalidArgs };

  // Alone among the runner-targeting commands, this one never launches. A read
  // of a runner that does not exist has nothing to return, so starting and
  // billing a pod in order to print no lines would serve nobody.
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: false, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { error: resolved.error, exitCode: resolved.exitCode };
  }

  // A stream name is a path segment on the runner rather than a closed set, so an
  // unknown one is a legal read that returns nothing. Said out loud, because a
  // typo that exits 0 with no output reads exactly like a stream with no entries.
  const known: readonly string[] = knownJournalStreams;
  if (!known.includes(parsed.value.stream)) {
    ctx.ui.warn(
      interactiveRunnerMessages.unknownStream(parsed.value.stream, known),
    );
  }

  const read = createJournalCursor(ctx, resolved.runnerId, parsed.value);
  const unreachable = createUnreachableBudget(pollIntervalMs);

  for (;;) {
    const window = await read();
    if (window.type === "failed") return window;

    // A single read has nothing to retry with, so an unreachable runner is all
    // it can report. A follow keeps asking until the grace window is spent.
    if (window.type === "unreachable") {
      if (!options.follow || unreachable.exhausted()) {
        return { ...unreachableFailure };
      }
      await deps.sleep(pollIntervalMs);
      continue;
    }
    unreachable.reset();

    for (const entry of window.entries) {
      const { data, line } = formatJournalLine(entry, {
        envelope: options.envelope,
      });
      ctx.ui.stream(data, line);
    }
    if (!options.follow) return undefined;
    await deps.sleep(pollIntervalMs);
  }
}
