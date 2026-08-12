import { z } from "zod";

/**
 * How long `run --follow` waits before it stops following.
 *
 * There has to be a bound, because a journal read counts as activity: following
 * a run is what keeps its runner from being reaped for inactivity, so a run that
 * never settles would have the follow hold a billing pod open for as long as the
 * terminal stayed open. An hour is longer than a flow run should ever need and
 * short enough that a forgotten terminal is not an overnight bill.
 */
export const defaultFollowTimeoutSeconds = 3600;

const followTimeoutSchema = z.coerce.number().int().positive();

export function parseFollowTimeout(
  seconds: string | undefined,
): { ok: true; seconds: number } | { ok: false; error: string } {
  if (seconds === undefined) {
    return { ok: true, seconds: defaultFollowTimeoutSeconds };
  }
  const parsed = followTimeoutSchema.safeParse(seconds);
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return { ok: true, seconds: parsed.data };
}
