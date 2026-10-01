import {
  type BrowserAction,
  type RunnerAction,
  browserActionSchema,
  runnerActionSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { parsePoint, toNumber } from "./flagValues.js";

/**
 * The action flags as the command line hands them over, every one a string.
 *
 * The field names are the computer-use vocabulary the vision models emit,
 * `snake_case` and all. They are not translated into something more CLI-shaped,
 * because the point of the surface is that an agent can forward its model's tool
 * call as it stands.
 */
export type ActionFlags = {
  button: string | undefined;
  durationMs: string | undefined;
  from: string | undefined;
  keys: string[] | undefined;
  path: string | undefined;
  scrollX: string | undefined;
  scrollY: string | undefined;
  selector: string | undefined;
  strategy: string | undefined;
  text: string | undefined;
  to: string | undefined;
  url: string | undefined;
  x: string | undefined;
  y: string | undefined;
};

export type BuiltAction<Action> =
  | { ok: true; action: Action }
  | { ok: false; error: string };

function parseJsonPath(
  path: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(path) };
  } catch {
    return {
      error:
        '--path must be a JSON array of points, for example \'[{"x":10,"y":20},{"x":80,"y":90}]\'.',
      ok: false,
    };
  }
}

/**
 * Assembles one raw action from what the command line supplied, and puts it to
 * the published schema.
 *
 * No bound is restated here. The schema is strict and every limit on it has a
 * reason at the runner (a typed string holds the pointer and keyboard for 50 ms
 * per character, a coordinate reaches an input injector), so it is the one thing
 * that decides whether an action is admissible; this file only turns flags into
 * the shape it reads. That is also why an unset flag is left out entirely rather
 * than passed as undefined: the schema refuses a key the chosen action does not
 * have, which is how `act click --text hi` is answered rather than silently
 * dropping the text.
 */
export function buildRunnerAction(
  type: string,
  flags: ActionFlags,
): BuiltAction<RunnerAction> {
  const parsedPath =
    flags.path === undefined ? undefined : parseJsonPath(flags.path);
  if (parsedPath !== undefined && !parsedPath.ok) return parsedPath;
  const from =
    flags.from === undefined ? undefined : parsePoint("--from", flags.from);
  if (from !== undefined && !from.ok) return from;
  const to = flags.to === undefined ? undefined : parsePoint("--to", flags.to);
  if (to !== undefined && !to.ok) return to;

  const candidate = {
    type,
    ...(flags.button === undefined ? {} : { button: flags.button }),
    ...(flags.durationMs === undefined
      ? {}
      : { duration_ms: toNumber(flags.durationMs) }),
    ...(from === undefined ? {} : { from: from.value }),
    ...(flags.keys === undefined ? {} : { keys: flags.keys }),
    ...(parsedPath === undefined ? {} : { path: parsedPath.value }),
    ...(flags.scrollX === undefined
      ? {}
      : { scroll_x: toNumber(flags.scrollX) }),
    ...(flags.scrollY === undefined
      ? {}
      : { scroll_y: toNumber(flags.scrollY) }),
    ...(flags.selector === undefined ? {} : { selector: flags.selector }),
    ...(flags.strategy === undefined ? {} : { strategy: flags.strategy }),
    ...(flags.text === undefined ? {} : { text: flags.text }),
    ...(to === undefined ? {} : { to: to.value }),
    ...(flags.url === undefined ? {} : { url: flags.url }),
    ...(flags.x === undefined ? {} : { x: toNumber(flags.x) }),
    ...(flags.y === undefined ? {} : { y: toNumber(flags.y) }),
  };

  return parseRunnerAction(candidate);
}

function parseWith<Action>(
  schema: z.ZodType<Action>,
  candidate: unknown,
): BuiltAction<Action> {
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error), ok: false };
  }
  return { action: parsed.data, ok: true };
}

/** Puts one complete action, as a caller's model emitted it, to the schema `runner act` sends. */
export function parseRunnerAction(
  candidate: unknown,
): BuiltAction<RunnerAction> {
  return parseWith(runnerActionSchema, candidate);
}

/** Puts one action of a `runner actions` sequence, which takes browser actions only, to its schema. */
export function parseBrowserAction(
  candidate: unknown,
): BuiltAction<BrowserAction> {
  return parseWith(browserActionSchema, candidate);
}
