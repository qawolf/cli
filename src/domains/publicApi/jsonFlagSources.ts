import { errorMessage, isNoEntError } from "~/core/errors.js";
import type { FlagSpec } from "~/core/publicApi/flagSpecs.js";
import type { Fs } from "~/shell/fs.js";

import { flagName } from "./flagValues.js";

export type JsonSourceDeps = {
  readFile: Fs["readFile"];
  readStdin: () => Promise<string>;
};

type ReadResult = { ok: true; text: string } | { ok: false; error: string };

const stdinSource = "-";
const fileSourcePrefix = "@";

async function readFileSource(
  flag: FlagSpec,
  path: string,
  deps: JsonSourceDeps,
): Promise<ReadResult> {
  try {
    return { ok: true, text: await deps.readFile(path) };
  } catch (error) {
    const reason = isNoEntError(error)
      ? "does not exist"
      : `could not be read (${errorMessage(error)})`;
    return {
      ok: false,
      error: `Invalid ${flagName(flag)} value: file "${path}" ${reason}.`,
    };
  }
}

async function readSource(
  flag: FlagSpec,
  value: string,
  deps: JsonSourceDeps,
): Promise<ReadResult> {
  if (value.startsWith(fileSourcePrefix)) {
    return readFileSource(flag, value.slice(fileSourcePrefix.length), deps);
  }
  if (value !== stdinSource) return { ok: true, text: value };
  const text = await deps.readStdin();
  if (text.trim() === "") {
    return {
      ok: false,
      error: `Invalid ${flagName(flag)} value: nothing was piped to stdin.`,
    };
  }
  return { ok: true, text };
}

// A JSON flag takes its value inline, from a file as `@<path>`, or from stdin
// as `-`. Neither form is valid JSON on its own, so neither shadows an inline
// value. This swaps each one for the text it points at.
export async function readJsonFlagSources(
  flags: FlagSpec[],
  options: Record<string, unknown>,
  deps: JsonSourceDeps,
): Promise<
  { ok: true; options: Record<string, unknown> } | { ok: false; error: string }
> {
  const jsonFlags = flags.filter((flag) => flag.kind === "json");
  const stdinFlags = jsonFlags.filter(
    (flag) => options[flag.optionKey] === stdinSource,
  );
  if (stdinFlags.length > 1) {
    return {
      ok: false,
      error: `Only one flag can read stdin, but ${stdinFlags.map(flagName).join(" and ")} are each set to -.`,
    };
  }

  const resolved = { ...options };
  for (const flag of jsonFlags) {
    const value = options[flag.optionKey];
    if (typeof value !== "string") continue;
    const read = await readSource(flag, value, deps);
    if (!read.ok) return read;
    resolved[flag.optionKey] = read.text;
  }
  return { ok: true, options: resolved };
}
