import { z } from "zod";

const followTimeoutSchema = z.coerce.number().int().positive();

/** A `--timeout <seconds>` flag as a number, with the command's default for an absent one. */
export function parseFollowTimeout(
  seconds: string | undefined,
  defaultSeconds: number,
): { ok: true; seconds: number } | { ok: false; error: string } {
  if (seconds === undefined) return { ok: true, seconds: defaultSeconds };
  const parsed = followTimeoutSchema.safeParse(seconds);
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return { ok: true, seconds: parsed.data };
}
