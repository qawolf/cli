import { join } from "node:path";

// npm writes both an extension-less POSIX shell script and an appium.cmd batch
// wrapper into node_modules/.bin. Windows CreateProcess can only run the .cmd.
export function resolveAppiumBin(
  envDir: string,
  platform: NodeJS.Platform,
): string {
  const name = platform === "win32" ? "appium.cmd" : "appium";
  return join(envDir, "node_modules", ".bin", name);
}
