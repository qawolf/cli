import { join } from "node:path";

import { isNoEntError } from "~/core/errors.js";
import { parseDotenv, serializeDotenv } from "~/core/dotenv.js";
import type { FlowRuntimeDeps } from "~/domains/runner/flowRuntimeDeps.js";
import type { Fs } from "~/shell/fs.js";

function envFilePath(envDir: string): string {
  return join(envDir, ".env");
}

async function readEnv(
  envDir: string,
  fs: Fs,
): Promise<Record<string, string>> {
  try {
    return parseDotenv(await fs.readFile(envFilePath(envDir)));
  } catch (err) {
    if (isNoEntError(err)) return {};
    throw err;
  }
}

async function writeEnv(
  envDir: string,
  fs: Fs,
  vars: Record<string, string>,
): Promise<void> {
  const target = envFilePath(envDir);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, serializeDotenv(vars), { mode: 0o600 });
  await fs.rename(tmp, target);
}

// Flows persist values (e.g. freshly minted auth tokens) across runs via
// `setEnvironmentVariable`, and reload them via `fetchLatestEnvironmentVariables`.
// Locally we back these by the project's `.env` so subsequent flows — and the
// rest of the current flow — observe the change.
export function makeEnvVarDeps(envDir: string, fs: Fs): FlowRuntimeDeps {
  return {
    setEnvironmentVariable: async (key: string, value: string) => {
      const vars = await readEnv(envDir, fs);
      vars[key] = value;
      await writeEnv(envDir, fs, vars);
      process.env[key] = value;
    },
    fetchLatestEnvironmentVariables: async () => {
      const vars = await readEnv(envDir, fs);
      // Explicit reload: override existing process.env values with the latest
      // from disk (unlike initial load, which only fills missing keys).
      for (const [key, value] of Object.entries(vars)) {
        process.env[key] = value;
      }
    },
  };
}
