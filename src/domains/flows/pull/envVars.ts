import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";

import { serializeDotenv } from "~/core/dotenv.js";

export async function writeEnvFile(
  envDir: string,
  vars: Record<string, string>,
  fs: Fs = makeDefaultFs(),
): Promise<void> {
  if (Object.keys(vars).length === 0) return;
  await fs.writeFile(join(envDir, ".env"), serializeDotenv(vars), {
    mode: 0o600,
  });
}
