// Windows ships npm as npm.cmd (plus npm.ps1 and a POSIX script) — there is no
// npm.exe. libuv's spawn PATH search ignores PATHEXT and only appends .com/.exe,
// so a bare "npm" fails with ENOENT even when `npm --version` works in the same
// shell, because cmd.exe does apply PATHEXT. Pair the result with
// buildSpawnOptions, which supplies the shell:true that Node requires to run a
// .cmd (CVE-2024-27980). WSL reports "linux" and carries a POSIX npm, so it
// takes the bare-name branch; Git Bash runs a Windows Node build, reports
// "win32", and needs npm.cmd.
export function resolveNpmCommand(platform: NodeJS.Platform): string {
  return platform === "win32" ? "npm.cmd" : "npm";
}
