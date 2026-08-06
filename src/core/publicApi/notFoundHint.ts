import type { FlagSpec } from "./flagSpecs.js";

// Enough context for a 404 to name the resource the user looked up, the id
// they passed, and the flag that carried it — e.g. `--issue-id`.
export type NotFoundHint = {
  // Human resource label, e.g. "issue".
  resource: string;
  // The flag the user passed to identify it, e.g. "--issue-id".
  idFlag: string;
  // The id value the user passed.
  idValue: string;
};

const flagName = (flag: FlagSpec): string =>
  flag.flag.split(" ", 1)[0] ?? flag.flag;

// When a command identifies exactly one resource by a required `*Id` flag, a
// 404 can name that resource, its flag, and the value the user passed.
// Endpoints that take several ids (or none) get no hint — the missing one is
// ambiguous, so callers fall back to the server's message or a neutral
// not-found.
export function buildNotFoundHint(
  flags: FlagSpec[],
  options: Record<string, unknown>,
): NotFoundHint | undefined {
  const idFlags = flags.filter(
    (flag) => flag.required && flag.field.endsWith("Id"),
  );
  const only = idFlags.length === 1 ? idFlags[0] : undefined;
  if (!only) return undefined;

  const value = options[only.field];
  if (typeof value !== "string" || !value) return undefined;

  return {
    resource: only.field.replace(/Id$/, ""),
    idFlag: flagName(only),
    idValue: value,
  };
}
