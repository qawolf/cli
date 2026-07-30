// Windows has no npm.exe, and libuv's spawn PATH search ignores PATHEXT, so a
// bare "npm" is ENOENT there even when `npm --version` works. WSL reports
// "linux" and carries a POSIX npm; Git Bash reports "win32" and needs npm.cmd.
// Pass the result through buildSpawnOptions, which adds the required shell.
export function resolveNpmCommand(platform: NodeJS.Platform): string {
  return platform === "win32" ? "npm.cmd" : "npm";
}
