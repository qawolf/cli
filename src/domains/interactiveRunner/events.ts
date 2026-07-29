import { journalStreamSchema } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { formatJournalLine } from "~/core/interactiveRunner/journal.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { readJournal } from "./readJournal.js";
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
      since: sequenceSchema.optional(),
      stream: journalStreamSchema,
      tail: countSchema.optional(),
    })
    .safeParse({
      stream: options.stream,
      ...(options.since === undefined ? {} : { since: options.since }),
      ...(options.tail === undefined ? {} : { tail: options.tail }),
    });
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return {
    ok: true,
    value: {
      runId: options.run,
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

  let request = parsed.value;
  for (;;) {
    const window = await readJournal(ctx, resolved.runnerId, request);
    if (!window.ok) return { error: window.error, exitCode: window.exitCode };
    for (const entry of window.value.entries) {
      ctx.ui.stream(formatJournalLine(entry, { envelope: options.envelope }));
    }
    if (!options.follow) return undefined;
    request = {
      ...request,
      sinceSequence: window.value.nextSequence,
      tail: undefined,
    };
    await deps.sleep(pollIntervalMs);
  }
}
