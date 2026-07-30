import { join } from "node:path";

// The SDK ships emulator.exe and adb.exe on Windows. libuv appends .exe only
// during a PATH search, so an explicit ANDROID_HOME path needs the extension.
function withExeSuffix(name: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? `${name}.exe` : name;
}

export function emulatorBin(
  home: string | undefined,
  platform: NodeJS.Platform,
): string {
  const name = withExeSuffix("emulator", platform);
  return home ? join(home, "emulator", name) : name;
}

export function adbBin(
  home: string | undefined,
  platform: NodeJS.Platform,
): string {
  const name = withExeSuffix("adb", platform);
  return home ? join(home, "platform-tools", name) : name;
}
