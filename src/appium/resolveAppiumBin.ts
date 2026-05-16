import { join } from "node:path";

export function resolveAppiumBin(envDir: string): string {
  return join(envDir, "node_modules", ".bin", "appium");
}
