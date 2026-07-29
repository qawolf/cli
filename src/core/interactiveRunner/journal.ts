import type { JournalEntry } from "@qawolf/api-contracts/v1";
import { z } from "zod";

/**
 * One line of journal output. The payload alone by default, so that
 * `qawolf runner events recorder --tail 5` composes with `grep` and `jq` on the
 * thing a reader came for; the whole envelope when a caller asked for the
 * sequence and timestamp it needs to page or correlate.
 */
export function formatJournalLine(
  entry: JournalEntry<unknown>,
  options: { envelope: boolean },
): string {
  return JSON.stringify(options.envelope ? entry : entry.payload);
}

/**
 * What the CLI reads out of a `run-status` payload.
 *
 * `status` is kept as the string the runner wrote rather than narrowed to the
 * three we know: a terminal status added later must still end a `--follow`, and a
 * follow that ran forever because it did not recognise the ending would be the
 * worse failure. Only `in-progress` is matched by name, because that is the one
 * status that means "keep waiting".
 *
 * Declared here rather than imported because the payload schemas live in the
 * platform's private journal package while only the envelope is published. This
 * is the one place the CLI restates a wire shape, and it stays deliberately
 * minimal so that it cannot disagree with a payload that grows fields.
 */
const runStatusPayloadSchema = z.object({
  errorMessage: z.string().optional(),
  runId: z.string(),
  status: z.string(),
});

export type RunSettlement =
  | { type: "in-progress" }
  | { type: "settled"; errorMessage: string | undefined; status: string }
  | { type: "unreadable" };

export function readRunSettlement(payload: unknown): RunSettlement {
  const parsed = runStatusPayloadSchema.safeParse(payload);
  if (!parsed.success) return { type: "unreadable" };
  if (parsed.data.status === "in-progress") return { type: "in-progress" };
  return {
    errorMessage: parsed.data.errorMessage,
    status: parsed.data.status,
    type: "settled",
  };
}

/**
 * A run's own log line, as much of it as the CLI renders. Tolerant for the same
 * reason as above: an entry it cannot read is printed as JSON rather than
 * dropped, because a `--follow` that silently omits lines is worse than an ugly
 * one.
 */
const runLogPayloadSchema = z.object({ message: z.string() });

export function formatRunLogLine(payload: unknown): string {
  const parsed = runLogPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data.message : JSON.stringify(payload);
}
