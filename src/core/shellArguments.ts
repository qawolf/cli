/** Quotes one literal argument; PowerShell syntax is not cmd.exe syntax. */
export function quoteShellArgument(
  value: string,
  dialect: "posix" | "powershell",
): string {
  const bare =
    dialect === "powershell" ? /^[a-zA-Z0-9_./\\:-]+$/ : /^[a-zA-Z0-9_./-]+$/;
  if (bare.test(value)) return value;
  if (dialect === "powershell") {
    // PowerShell treats smart apostrophes as quote delimiters too.
    return `'${value.replace(/['\u2018-\u201b]/g, "$&$&")}'`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}
