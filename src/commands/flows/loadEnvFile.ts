import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isNoEntError } from "~/core/errors.js";
import { parseDotenv } from "~/core/dotenv.js";

export async function loadEnvFile(envDir: string): Promise<void> {
  let content: string;
  try {
    content = await readFile(join(envDir, ".env"), "utf8");
  } catch (err) {
    if (isNoEntError(err)) return;
    throw err;
  }
  const vars = parseDotenv(content);
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
