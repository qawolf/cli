import { existsSync } from "node:fs";
import { join } from "node:path";

const notFoundMessage =
  "Could not find Playwright. Install it in your project (`npm install playwright` or `bun add playwright`).";

// On Windows, npm/bun installs both an extension-less POSIX shell script and
// a .cmd batch wrapper in node_modules/.bin/. Node's spawn (without shell:true)
// can only execute the .cmd, so we must prefer it.
export function resolvePlaywrightCli(
  envDir: string,
  platform: NodeJS.Platform,
): string {
  const binDir = join(envDir, "node_modules", ".bin");
  const candidates =
    platform === "win32" ? ["playwright.cmd", "playwright"] : ["playwright"];
  for (const candidate of candidates) {
    const full = join(binDir, candidate);
    if (existsSync(full)) return full;
  }
  throw new Error(notFoundMessage);
}
