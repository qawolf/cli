import { join } from "node:path";

// Windows cannot execute the extension-less POSIX shim. CreateProcess reports
// ENOENT for it. The package managers write different Windows shims: npm a
// .cmd, bun an .exe.
export function playwrightCliCandidates(
  envDir: string,
  platform: NodeJS.Platform,
): string[] {
  const binDir = join(envDir, "node_modules", ".bin");
  const names =
    platform === "win32"
      ? ["playwright.cmd", "playwright.exe"]
      : ["playwright"];
  return names.map((name) => join(binDir, name));
}
