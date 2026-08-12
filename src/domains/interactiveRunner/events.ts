import { knownJournalStreams } from "@qawolf/api-contracts/v1";

import { parseFollowTimeout } from "~/core/interactiveRunner/followTimeout.js";
import { formatJournalLine } from "~/core/interactiveRunner/journal.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import {
  type RunnerEventsOptions,
  parseEventsOptions,
} from "./eventsOptions.js";
import {
  createJournalCursor,
  createUnreachableBudget,
} from "./journalCursor.js";
import { journalReadFailure, unreachableFailure } from "./readJournal.js";
import { resolveRunner } from "./resolveRunner.js";

export type { RunnerEventsOptions } from "./eventsOptions.js";

const pollIntervalMs = 1_000;

/**
 * Prints one stream of a runner's journal, one entry per line.
 *
 * `--follow` polls the cursor the previous read handed back rather than holding a
 * connection, which is the same code path as a plain read and works from a
 * sandbox that can only make requests. `tail` applies to the first read only:
 * afterwards there is a cursor, and re-applying a tail would skip entries that
 * arrived between polls.
 *
 * `timeoutSeconds` bounds a follow for the same reason `run --follow` is
 * bounded: a journal read counts as activity, so a follow left open keeps the
 * runner alive and billing for as long as the terminal stayed open.
 */
export async function handleRunnerEvents(
  ctx: AuthCommandContext,
  options: RunnerEventsOptions,
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const parsed = parseEventsOptions(options);
  if (!parsed.ok)
    return { error: parsed.error, exitCode: exitCodes.invalidArgs };

  const timeout = parseFollowTimeout(options.timeout);
  if (!timeout.ok) {
    return { error: timeout.error, exitCode: exitCodes.invalidArgs };
  }

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

  // Polls rather than a clock, like followRun: the loop sleeps a known interval
  // between reads, so counting them bounds the follow.
  const maxPolls = Math.max(
    1,
    Math.ceil((timeout.seconds * 1_000) / pollIntervalMs),
  );

  for (let poll = 1; ; poll++) {
    const window = await read();
    if (window.type === "failed") return journalReadFailure(window);

    // A single read has nothing to retry with, so an unreachable runner is all
    // it can report. A follow keeps asking until the grace window is spent.
    if (window.type === "unreachable") {
      if (!options.follow || unreachable.exhausted()) {
        return { ...unreachableFailure };
      }
    } else {
      unreachable.reset();

      for (const entry of window.entries) {
        const { data, line } = formatJournalLine(entry, {
          envelope: options.envelope,
        });
        ctx.ui.stream(data, line);
      }
      if (!options.follow) return undefined;
    }

    if (poll >= maxPolls) {
      return {
        error: interactiveRunnerMessages.followEventsTimedOut(
          parsed.value.stream,
          timeout.seconds,
        ),
        exitCode: exitCodes.timeout,
      };
    }
    await deps.sleep(pollIntervalMs);
  }
}
