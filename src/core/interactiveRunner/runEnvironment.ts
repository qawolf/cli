import { runEnvironmentSchema } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { parseDotenv } from "~/core/dotenv.js";
import { errorMessage } from "~/core/errors.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";

export type BuiltRunEnvironment =
  | { ok: true; environment: Record<string, string> }
  | { ok: false; error: string };

/** The environment a run is given, from the dotenv file a caller named. */
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

  return checkRunEnvironment(parsed);
}

/**
 * Put to the published schema, so the name rules, the reserved name and the
 * count and length caps are refused here with the offending name rather than
 * after a round trip.
 */
export function checkRunEnvironment(
  environment: Record<string, string>,
): BuiltRunEnvironment {
  const checked = runEnvironmentSchema.safeParse(environment);
  if (!checked.success) {
    return { error: z.prettifyError(checked.error), ok: false };
  }
  return { environment: checked.data, ok: true };
}

/**
 * The variables given one by one as `NAME=VALUE`. Split on the first `=`, so a
 * value may itself hold one.
 */
export function parseRunVariables(
  assignments: readonly string[],
): BuiltRunEnvironment {
  const environment: Record<string, string> = {};
  for (const assignment of assignments) {
    const separator = assignment.indexOf("=");
    const name = separator === -1 ? "" : assignment.slice(0, separator).trim();
    if (name === "") {
      return {
        error: interactiveRunnerMessages.varMalformed(assignment),
        ok: false,
      };
    }
    if (Object.hasOwn(environment, name)) {
      return {
        error: interactiveRunnerMessages.varRepeated(name),
        ok: false,
      };
    }
    environment[name] = assignment.slice(separator + 1);
  }
  return { environment, ok: true };
}
