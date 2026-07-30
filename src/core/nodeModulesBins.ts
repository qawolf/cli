import { join } from "node:path";

// Windows cannot execute the extension-less POSIX shim. CreateProcess reports
// ENOENT for it. The package managers write different Windows shims: npm a
// .cmd, bun an .exe.
export function nodeModulesBinCandidates(
  envDir: string,
  name: string,
  platform: NodeJS.Platform,
): string[] {
  const binDir = join(envDir, "node_modules", ".bin");
  const names = platform === "win32" ? [`${name}.cmd`, `${name}.exe`] : [name];
  return names.map((shim) => join(binDir, shim));
}

export function appiumCliCandidates(
  envDir: string,
  platform: NodeJS.Platform,
): string[] {
  return nodeModulesBinCandidates(envDir, "appium", platform);
}

export function playwrightCliCandidates(
  envDir: string,
  platform: NodeJS.Platform,
): string[] {
  return nodeModulesBinCandidates(envDir, "playwright", platform);
}
