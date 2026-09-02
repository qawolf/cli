import { InvalidArgumentError } from "commander";

// Strict integer parser. `String(n) !== value` rejects `"+3"`, leading zeros
// like `"03"`, and the JS oddity `"-0"` (String(-0) === "0") — same convention
// as most CLI tooling. The optional `min` bound surfaces domain errors
// (negative retries, zero workers, etc.) at parse time rather than deeper.
export function parseInteger(
  name: string,
  options: { min?: number } = {},
): (value: string) => number {
  return (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || String(n) !== value) {
      throw new InvalidArgumentError(`${name} must be an integer`);
    }
    if (options.min !== undefined && n < options.min) {
      throw new InvalidArgumentError(`${name} must be >= ${options.min}`);
    }
    return n;
  };
}

export function parseEnum<T extends string>(
  name: string,
  values: readonly T[],
): (value: string) => T {
  return (value) => {
    if (!(values as readonly string[]).includes(value)) {
      throw new InvalidArgumentError(
        `${name} must be one of: ${values.join(", ")}`,
      );
    }
    return value as T;
  };
}

/**
 * Accumulates a repeated flag into a list.
 *
 * Repeatable rather than variadic: a variadic option consumes every following
 * bare word, which silently swallows a positional argument (`--tag auth
 * pattern` reads `pattern` as a second tag).
 */
export function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}
