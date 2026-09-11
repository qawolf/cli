import {
  type InspectMobileRequest,
  inspectMobileRequestSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

/** No `by` here: which of a point, some text, or a selector was given is evident from which fields are set. */
export type InspectMobileFlags = {
  context: string | undefined;
  partial: boolean | undefined;
  selector: string | undefined;
  strategy: string | undefined;
  text: string | undefined;
  x: string | undefined;
  y: string | undefined;
};

export type BuiltInspectMobileRequest =
  | { ok: true; request: InspectMobileRequest }
  | { ok: false; error: string };

export const blankInspectMobileFlags: InspectMobileFlags = {
  context: undefined,
  partial: undefined,
  selector: undefined,
  strategy: undefined,
  text: undefined,
  x: undefined,
  y: undefined,
};

/** Blank reads as NaN rather than pixel 0, so the schema refuses it by name. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

const groupsOf = (flags: InspectMobileFlags) => ({
  point: flags.x !== undefined || flags.y !== undefined,
  selector: flags.selector !== undefined || flags.strategy !== undefined,
  text: flags.text !== undefined || flags.partial !== undefined,
});

/** Names which of a point's, text's, or a selector's flags were passed. */
function describeGroup(group: keyof ReturnType<typeof groupsOf>): string {
  switch (group) {
    case "point":
      return "--x/--y";
    case "selector":
      return "--selector/--strategy";
    case "text":
      return "--text/--partial";
  }
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
  const groups = groupsOf(flags);
  const present = (["point", "text", "selector"] as const).filter(
    (group) => groups[group],
  );

  if (present.length > 1) {
    return {
      error: `${describeGroup(present[0]!)} and ${describeGroup(present[1]!)} were both passed, but elements are found by a point, by text, or by a selector — never more than one at once. Drop all but one of them.`,
      ok: false,
    };
  }

  const by = present[0];
  const candidate = {
    what,
    ...(by === undefined ? {} : { by }),
    ...(flags.context === undefined ? {} : { context: flags.context }),
    ...(flags.partial === undefined ? {} : { partial: flags.partial }),
    ...(flags.selector === undefined ? {} : { selector: flags.selector }),
    ...(flags.strategy === undefined ? {} : { strategy: flags.strategy }),
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
