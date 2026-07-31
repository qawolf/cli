// Quoting for a `cmd.exe /d /s /c "<line>"` command line, per https://qntm.org/cmd.
// Getting this wrong is what BatBadBut (CVE-2024-27980) exploited.
const metaChars = /([()\][%!^"`<>&|;, *?])/g;

export function escapeCommand(command: string): string {
  return command.replace(metaChars, "^$1");
}

// The lookahead form avoids the quadratic backtracking that `(\\*)"` hits on a
// long backslash run: https://github.com/moxystudio/node-cross-spawn/pull/160
export function escapeArgument(arg: string): string {
  const escaped = arg
    .replace(/(?=(\\+?)?)\1"/g, '$1$1\\"')
    .replace(/(?=(\\+?)?)\1$/, "$1$1");
  // Twice, because a .cmd shim forwards %* and cmd.exe parses the line again.
  // cmd.exe ignores the backslash-escaped quote above, so with one layer an
  // argument like `a"&echo pwned` closes the quoted run and executes. Halving
  // this reds four cases in test/spawn/cmdEscapeSmoke.mjs.
  return `"${escaped}"`.replace(metaChars, "^$1").replace(metaChars, "^$1");
}
