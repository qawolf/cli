import {
  journalStreamSchema,
  readJournalRequestSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

export type RunnerEventsOptions = {
  envelope: boolean;
  follow: boolean;
  run: string | undefined;
  runner: string | undefined;
  since: string | undefined;
  stream: string;
  tail: string | undefined;
  timeout: string | undefined;
};

const countSchema = z.coerce.number().int().positive();
const sequenceSchema = z.coerce.number().int().nonnegative();

export type ParsedEventsOptions = {
  runId: string | undefined;
  sinceSequence: number | undefined;
  stream: string;
  tail: number | undefined;
};

export function parseEventsOptions(
  options: RunnerEventsOptions,
): { ok: true; value: ParsedEventsOptions } | { ok: false; error: string } {
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
