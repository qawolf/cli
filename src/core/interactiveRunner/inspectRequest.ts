import {
  type InspectOnRunnerRequest,
  inspectRequestSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

export type InspectFlags = {
  name: string | undefined;
  selector: string | undefined;
};

export type BuiltInspectRequest =
  | { ok: true; request: InspectOnRunnerRequest }
  | { ok: false; error: string };

/**
 * Turns a subcommand and its flags into one inspect request.
 *
 * Put to the published schema rather than checked by hand, so the selector and
 * variable-name limits come from the same place the server applies them and an
 * over-long selector is refused before a runner is addressed.
 */
export function buildInspectRequest(
  what: InspectOnRunnerRequest["what"],
  flags: InspectFlags,
): BuiltInspectRequest {
  const candidate = {
    what,
    ...(flags.selector === undefined ? {} : { selector: flags.selector }),
    ...(flags.name === undefined ? {} : { variableName: flags.name }),
  };

  const parsed = inspectRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error), ok: false };
  }
  return { ok: true, request: parsed.data };
}
