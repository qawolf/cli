import { join } from "node:path";

// npm/bun writes both an extension-less POSIX script and a .cmd wrapper into
// node_modules/.bin; Windows CreateProcess can only run the .cmd.
export function playwrightCliCandidates(
  envDir: string,
  platform: NodeJS.Platform,
): string[] {
  const binDir = join(envDir, "node_modules", ".bin");
  const names =
    platform === "win32" ? ["playwright.cmd", "playwright"] : ["playwright"];
  return names.map((name) => join(binDir, name));
}
