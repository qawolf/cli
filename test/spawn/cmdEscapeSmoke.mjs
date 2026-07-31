// Round-trips arguments through a real cmd.exe. cmdEscape.test.ts asserts the
// shape of the escaped string, which cannot show the shape is right.
//
// argv.cmd forwards %* to node, so each argument reaches a real argv. npm.cmd
// and the Android .bat launchers forward %* the same way.
//
// Measured against a mutated escapeArgument: deleting it reds 7 of the first 8
// cases, and halving it to one caret layer reds the last 4. Both let "echo
// pwned" run. The quote-then-metacharacter cases are what separate the two
// caret layers, so keep them.
//
// spawn.generated.mjs is src/shell/spawn.ts bundled by bun.
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("cmd-escape smoke SKIPPED: not win32");
  process.exit(0);
}

const { defaultSpawn } = await import("./spawn.generated.mjs");

const argvCmd = fileURLToPath(new URL("./argv.cmd", import.meta.url));

// Unescaped, %SMOKE_VAR% arrives as "expanded". Escaped, it stays literal.
const env = { SMOKE_VAR: "expanded" };

// Escaping makes the round-trip an identity, so each argument is its own
// expectation.
const args = [
  "a b",
  "a&b",
  "a^b",
  "a|b",
  'a"b',
  "C:\\dir\\",
  "%SMOKE_VAR%",
  "a b & echo pwned",
  // cmd.exe does not honour the backslash-escaped quote that escapeArgument
  // writes, so an embedded quote can close the quoted run and expose what
  // follows it to the shim's own parse.
  'a"&echo pwned',
  '"&echo pwned',
  'a\\"|echo pwned',
  'x" & echo pwned & "y',
];

let failed = 0;

for (const arg of args) {
  const result = await defaultSpawn(argvCmd, [arg], {
    platform: process.platform,
    env,
  });
  let actual;
  try {
    actual = JSON.parse(result.stdout.trim());
  } catch {
    actual = [`<unparseable: ${result.stdout.trim()}>`];
  }
  const ok = result.exitCode === 0 && actual.length === 1 && actual[0] === arg;
  if (!ok) failed += 1;
  const detail = ok ? "" : ` (exit ${result.exitCode})`;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${JSON.stringify(arg)} -> ${JSON.stringify(actual)}${detail}`,
  );
}

if (failed > 0) {
  console.error(`cmd-escape smoke FAILED: ${failed}/${args.length} arguments`);
  process.exit(1);
}

console.log(`cmd-escape smoke OK: ${args.length} arguments round-tripped`);
