// Shared serializer / parser for the dotenv format `qawolf flows pull` writes
// and `qawolf flows run` reads. Always double-quotes values; escapes `\\`,
// `\"`, `\n`, `\r`, `\t`. Round-trips exactly (escape/unescape are inverses).

const envKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const lineRe = /^([A-Za-z_][A-Za-z0-9_]*)="((?:[^"\\]|\\.)*)"$/;

export function serializeDotenv(vars: Record<string, string>): string {
  const keys = Object.keys(vars).sort();
  for (const key of keys) {
    if (!envKeyPattern.test(key)) {
      throw new Error(
        `Cannot serialize env var with invalid key: ${JSON.stringify(key)}`,
      );
    }
  }
  if (keys.length === 0) return "";
  return `${keys.map((k) => `${k}=${quote(vars[k] ?? "")}`).join("\n")}\n`;
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
    const m = lineRe.exec(line);
    if (!m) {
      throw new Error(`Cannot parse .env line: ${JSON.stringify(line)}`);
    }
    out[m[1]!] = unquote(m[2]!);
  }
  return out;
}

// Walks the string pairing `\X` with its escape char. Reversing the
// serializer's order — handle `\\` last is unsafe because intermediate state
// can contain real backslashes that would re-match. Single-pass walk avoids
// the ambiguity entirely.
function unquote(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "\\") out += "\\";
      else if (next === '"') out += '"';
      else if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === "t") out += "\t";
      else out += next;
      i += 2;
    } else {
      out += s[i];
      i += 1;
    }
  }
  return out;
}
