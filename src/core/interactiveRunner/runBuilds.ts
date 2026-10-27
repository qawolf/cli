import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

/**
 * The build ids a `runner run --builds` names, put to the published schema so
 * a malformed id or too many builds are refused before a runner is launched.
 */
export function parseRunBuilds(
  values: readonly string[],
): { ok: true; builds: string[] | undefined } | { ok: false; error: string } {
  if (values.length === 0) return { builds: undefined, ok: true };
  const checked =
    publicContractsV1.runner.runFlow.input.shape.builds.safeParse(values);
  if (!checked.success) {
    return { error: z.prettifyError(checked.error), ok: false };
  }
  return { builds: checked.data, ok: true };
}
