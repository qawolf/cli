import { quoteShellArgument } from "~/core/shellArguments.js";

/** A fixed paste format, since the launching shell cannot be inferred from OS/env. */
export function formatClipboardPaths(
  paths: readonly string[],
  platform: NodeJS.Platform = process.platform,
): {
  text: string;
  syntax: string | undefined;
} {
  const dialect = platform === "win32" ? "powershell" : "posix";
  const quoted = paths.map((path) => quoteShellArgument(path, dialect));
  return {
    text: quoted.join(" "),
    syntax:
      dialect === "powershell" &&
      quoted.some((path, index) => path !== paths[index])
        ? "PowerShell syntax"
        : undefined,
  };
}
