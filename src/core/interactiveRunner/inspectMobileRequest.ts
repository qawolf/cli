import {
  type InspectMobileRequest,
  inspectMobileRequestSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

/** The mobile inspect flags as the command line hands them over. */
export type InspectMobileFlags = {
  by: string | undefined;
  context: string | undefined;
  partial: boolean | undefined;
  text: string | undefined;
  x: string | undefined;
  y: string | undefined;
};

export type BuiltInspectMobileRequest =
  | { ok: true; request: InspectMobileRequest }
  | { ok: false; error: string };

/** Blank reads as NaN rather than pixel 0, so the schema refuses it by name. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Turns a subcommand and its flags into one mobile inspect request, put to the
 * published schema rather than checked by hand — same reasoning as
 * `buildInspectRequest`.
 */
export function buildInspectMobileRequest(
  what: string,
  flags: InspectMobileFlags,
): BuiltInspectMobileRequest {
  // The schema strips fields the chosen `by` does not define rather than
  // refusing them, so a flag from the other `by` would be silently ignored
  // rather than reported — the same reason a flag alongside stdin is refused
  // in `readAction.ts` rather than dropped.
  if (
    flags.by === "point" &&
    (flags.text !== undefined || flags.partial !== undefined)
  ) {
    return {
      error:
        "--by point matches by pixel, so --text/--partial would be ignored rather than searching by text. Pass --by text instead, or drop --text/--partial.",
      ok: false,
    };
  }
  if (flags.by === "text" && (flags.x !== undefined || flags.y !== undefined)) {
    return {
      error:
        "--by text matches by text, so --x/--y would be ignored rather than matching a point. Pass --by point instead, or drop --x/--y.",
      ok: false,
    };
  }

  const candidate = {
    what,
    ...(flags.by === undefined ? {} : { by: flags.by }),
    ...(flags.context === undefined ? {} : { context: flags.context }),
    ...(flags.partial === undefined ? {} : { partial: flags.partial }),
    ...(flags.text === undefined ? {} : { text: flags.text }),
    ...(flags.x === undefined ? {} : { x: toNumber(flags.x) }),
    ...(flags.y === undefined ? {} : { y: toNumber(flags.y) }),
  };

  const parsed = inspectMobileRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error), ok: false };
  }
  return { ok: true, request: parsed.data };
}
