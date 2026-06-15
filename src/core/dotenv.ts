// Shared serializer / parser for the dotenv format `qawolf flows pull` writes
// and `qawolf flows run` reads. Always double-quotes values; escapes `\\`,
// `\"`, `\n`, `\r`, `\t`. Round-trips exactly (escape/unescape are inverses).

import { flowsMessages } from "~/core/messages/index.js";

const envKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const lineRe = /^([A-Za-z_][A-Za-z0-9_]*)="((?:[^"\\]|\\.)*)"$/;

export type SerializeDotenvSkippingInvalidResult = {
  readonly content: string;
  // Keys that are not valid POSIX shell identifiers (e.g. they contain a `.`
  // or a space). A `.env` file cannot represent them, so pull callers can
  // choose to skip them while surfacing the names to the user.
  readonly skippedKeys: readonly string[];
};

function isDotenvKey(key: string): boolean {
  return envKeyPattern.test(key);
}

export function serializeDotenv(vars: Record<string, string>): string {
  const keys = Object.keys(vars).sort();
  for (const key of keys) {
    if (!isDotenvKey(key)) {
      throw new Error(flowsMessages.dotenv.invalidKey(key));
    }
  }
  if (keys.length === 0) return "";
  return `${keys.map((key) => `${key}=${quote(vars[key] ?? "")}`).join("\n")}\n`;
}

export function serializeDotenvSkippingInvalid(
  vars: Record<string, string>,
): SerializeDotenvSkippingInvalidResult {
  const keys = Object.keys(vars).sort();
  const validVars: Record<string, string> = {};
  const skippedKeys: string[] = [];
  for (const key of keys) {
    if (isDotenvKey(key)) validVars[key] = vars[key] ?? "";
    else skippedKeys.push(key);
  }
  return { content: serializeDotenv(validVars), skippedKeys };
}

function quote(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t");
  return `"${escaped}"`;
}

export function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const match = lineRe.exec(line);
    if (!match) {
      throw new Error(flowsMessages.dotenv.unparseableLine(line));
    }
    out[match[1]!] = unquote(match[2]!);
  }
  return out;
}

// Walks the string pairing `\X` with its escape char. Reversing the
// serializer's order — handle `\\` last is unsafe because intermediate state
// can contain real backslashes that would re-match. Single-pass walk avoids
// the ambiguity entirely.
function unquote(escaped: string): string {
  let out = "";
  let i = 0;
  while (i < escaped.length) {
    if (escaped[i] === "\\" && i + 1 < escaped.length) {
      const next = escaped[i + 1];
      if (next === "\\") out += "\\";
      else if (next === '"') out += '"';
      else if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === "t") out += "\t";
      else out += next;
      i += 2;
    } else {
      out += escaped[i];
      i += 1;
    }
  }
  return out;
}
