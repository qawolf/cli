import type { FlagSpec } from "~/core/publicApi/flagSpecs.js";

export const flagName = (flag: FlagSpec): string =>
  flag.flag.split(" ", 1)[0] ?? flag.flag;

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function parseKeyValueRecord(
  flag: FlagSpec,
  pairs: string[],
): { ok: true; record: Record<string, string> } | { ok: false; error: string } {
  const record: Record<string, string> = {};
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex < 1) {
      return {
        ok: false,
        error: `Invalid ${flagName(flag)} value "${pair}": expected KEY=VALUE.`,
      };
    }
    record[pair.slice(0, separatorIndex)] = pair.slice(separatorIndex + 1);
  }
  return { ok: true, record };
}

export function parseJson(
  flag: FlagSpec,
  value: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `Invalid ${flagName(flag)} value: expected a JSON value.`,
    };
  }
  // The parser's message is left out: on Node it quotes part of the input.
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return {
      ok: false,
      error: `Invalid ${flagName(flag)} value: expected a JSON value.`,
    };
  }
}
