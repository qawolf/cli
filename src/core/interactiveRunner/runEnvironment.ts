import { runEnvironmentSchema } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { parseDotenv } from "~/core/dotenv.js";
import { errorMessage } from "~/core/errors.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";

export type BuiltRunEnvironment =
  | { ok: true; environment: Record<string, string> }
  | { ok: false; error: string };

/**
 * The environment a run is given, from the dotenv file a caller named.
 *
 * Put to the published schema, so the name rules, the reserved name and the
 * count and length caps are refused here with the offending name rather than
 * after a round trip.
 */
export function buildRunEnvironment(content: string): BuiltRunEnvironment {
  let parsed: Record<string, string>;
  try {
    parsed = parseDotenv(content);
  } catch (error) {
    return {
      error: interactiveRunnerMessages.envFileUnparseable(errorMessage(error)),
      ok: false,
    };
  }

  const checked = runEnvironmentSchema.safeParse(parsed);
  if (!checked.success) {
    return { error: z.prettifyError(checked.error), ok: false };
  }
  return { environment: checked.data, ok: true };
}
