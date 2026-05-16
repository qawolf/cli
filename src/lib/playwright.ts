import { existsSync } from "node:fs";
import { join } from "node:path";

export function resolvePlaywrightCli(envDir: string): string {
  const bin = join(envDir, "node_modules", ".bin", "playwright");
  if (!existsSync(bin)) {
    throw new Error(
      "Could not find Playwright. Install it in your project (`npm install playwright` or `bun add playwright`).",
    );
  }
  return bin;
}
