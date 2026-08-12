import {
  type BrowserAction,
  browserActionSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

/**
 * The action flags as the command line hands them over, every one a string.
 *
 * The field names are the computer-use vocabulary the vision models emit,
 * `snake_case` and all. They are not translated into something more CLI-shaped,
 * because the point of the surface is that an agent can forward its model's tool
 * call as it stands.
 */
export type BrowserActionFlags = {
  button: string | undefined;
  keys: string[] | undefined;
  path: string | undefined;
  scrollX: string | undefined;
  scrollY: string | undefined;
  text: string | undefined;
  url: string | undefined;
  x: string | undefined;
  y: string | undefined;
};

export type BuiltBrowserAction =
  | { ok: true; action: BrowserAction }
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
 * `Number("")` and `Number(" ")` are both 0, so an unset shell variable would
 * otherwise reach the runner as a click on the top-left pixel. NaN is what the
 * schema refuses by name, so a blank flag is answered the same way `--x abc` is.
 */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Assembles one raw browser action from what the command line supplied, and puts
 * it to the published schema.
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
export function buildBrowserAction(
  type: string,
  flags: BrowserActionFlags,
): BuiltBrowserAction {
  const parsedPath =
    flags.path === undefined ? undefined : parseJsonPath(flags.path);
  if (parsedPath !== undefined && !parsedPath.ok) return parsedPath;

  const candidate = {
    type,
    ...(flags.button === undefined ? {} : { button: flags.button }),
    ...(flags.keys === undefined ? {} : { keys: flags.keys }),
    ...(parsedPath === undefined ? {} : { path: parsedPath.value }),
    ...(flags.scrollX === undefined
      ? {}
      : { scroll_x: toNumber(flags.scrollX) }),
    ...(flags.scrollY === undefined
      ? {}
      : { scroll_y: toNumber(flags.scrollY) }),
    ...(flags.text === undefined ? {} : { text: flags.text }),
    ...(flags.url === undefined ? {} : { url: flags.url }),
    ...(flags.x === undefined ? {} : { x: toNumber(flags.x) }),
    ...(flags.y === undefined ? {} : { y: toNumber(flags.y) }),
  };

  return parseBrowserAction(candidate);
}

/** Puts a complete action, as a caller's model emitted it, to the same schema. */
export function parseBrowserAction(candidate: unknown): BuiltBrowserAction {
  const parsed = browserActionSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error), ok: false };
  }
  return { action: parsed.data, ok: true };
}
