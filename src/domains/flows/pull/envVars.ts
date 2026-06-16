import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";

import { serializeDotenvSkippingInvalid } from "~/core/dotenv.js";

export async function writeEnvFile(
  envDir: string,
  vars: Record<string, string>,
  fs: Fs = makeDefaultFs(),
): Promise<{ skippedKeys: readonly string[] }> {
  if (Object.keys(vars).length === 0) return { skippedKeys: [] };
  const { content, skippedKeys } = serializeDotenvSkippingInvalid(vars);
  // Only write when there is at least one valid var. An all-invalid set
  // serializes to "" and we leave no empty .env behind.
  if (content !== "") {
    await fs.writeFile(join(envDir, ".env"), content, { mode: 0o600 });
  }
  return { skippedKeys };
}
