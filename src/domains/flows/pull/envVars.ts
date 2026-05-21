import { writeFile } from "~/shell/fs.js";
import { join } from "node:path";

import { serializeDotenv } from "~/domains/flows/dotenv.js";

export async function writeEnvFile(
  envDir: string,
  vars: Record<string, string>,
): Promise<void> {
  if (Object.keys(vars).length === 0) return;
  await writeFile(join(envDir, ".env"), serializeDotenv(vars), {
    mode: 0o600,
  });
}
