import type { InspectMobileRequest } from "@qawolf/api-contracts/v1";
import * as apiContractsV1 from "@qawolf/api-contracts/v1";
import { z } from "zod";

// Not published yet (ARC-556): a named import of `inspectMobileRequestSchema`
// would crash `bun run generate` today, since ESM validates named imports at
// load time even for code that never runs. Reading it off the namespace
// defers that to whenever this actually gets called, same as everything else
// this depends on.
const inspectMobileRequestSchema: z.ZodType | undefined = (
  apiContractsV1 as { inspectMobileRequestSchema?: z.ZodType }
).inspectMobileRequestSchema;

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
  const candidate = {
    what,
    ...(flags.by === undefined ? {} : { by: flags.by }),
    ...(flags.context === undefined ? {} : { context: flags.context }),
    ...(flags.partial === undefined ? {} : { partial: flags.partial }),
    ...(flags.text === undefined ? {} : { text: flags.text }),
    ...(flags.x === undefined ? {} : { x: toNumber(flags.x) }),
    ...(flags.y === undefined ? {} : { y: toNumber(flags.y) }),
  };

  if (!inspectMobileRequestSchema) {
    return {
      error:
        "This build's @qawolf/api-contracts does not publish runner.inspectMobile yet. Upgrade with npm install -g @qawolf/cli once mobile inspect ships.",
      ok: false,
    };
  }

  const parsed = inspectMobileRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error), ok: false };
  }
  return { ok: true, request: parsed.data as InspectMobileRequest };
}
