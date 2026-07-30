import { join } from "node:path";

// Windows cannot execute the extension-less POSIX shim. The package managers
// write different Windows shims: npm a .cmd, bun an .exe.
export function appiumCliCandidates(
  envDir: string,
  platform: NodeJS.Platform,
): string[] {
  const binDir = join(envDir, "node_modules", ".bin");
  const names =
    platform === "win32" ? ["appium.cmd", "appium.exe", "appium"] : ["appium"];
  return names.map((name) => join(binDir, name));
}
