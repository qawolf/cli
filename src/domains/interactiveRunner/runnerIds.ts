import { runnerIdSchema } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { runnerNameSchema, type RunnerName } from "./runnerNames.js";

/**
 * Validates a runner id against the published schema before it reaches the wire,
 * so a typo is answered with the rule it broke rather than with a round trip.
 */
export function parseRunnerId(
  id: string,
): { ok: true; id: string } | { ok: false; error: string } {
  const parsed = runnerIdSchema.safeParse(id);
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return { id: parsed.data, ok: true };
}

/** The same, for the image name a runner is launched from. */
export function parseRunnerName(
  runnerName: string,
): { ok: true; runnerName: RunnerName } | { ok: false; error: string } {
  const parsed = runnerNameSchema.safeParse(runnerName);
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return { ok: true, runnerName: parsed.data };
}
