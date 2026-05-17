import { writeFile } from "~/shell/fs.js";
import { join } from "node:path";

import { createTrpcClient } from "~/shell/platform/createTrpcClient.js";
import { requestWithRetry } from "~/shell/platform/requestWithRetry.js";
import { environmentWithVariablesResponseSchema } from "~/shell/platform/types.js";
import { serializeDotenv } from "~/domains/flows/dotenv.js";
import { describeEnvVarsRequestError } from "./wireErrors.js";

type RequestEnvVarsDeps = {
  apiKey: string;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
};

const requestEnvVarsBackoffMs = [500, 1500];

export const envVarsTrpcPath = "environment.getEnvironmentWithVariables";

export async function requestEnvVars(
  deps: RequestEnvVarsDeps,
  envId: string,
): Promise<Record<string, string>> {
  const trpcClient = createTrpcClient(deps.apiKey, {
    baseUrl: deps.baseUrl,
    fetch: deps.fetch,
  });
  const data = await requestWithRetry({
    call: () =>
      trpcClient.query(
        envVarsTrpcPath,
        { id: envId },
        environmentWithVariablesResponseSchema,
      ),
    backoffMs: requestEnvVarsBackoffMs,
    describe: (err) => describeEnvVarsRequestError(err, deps.baseUrl),
    sleep: deps.sleep,
  });
  return data.environmentVariables;
}

export async function writeEnvFile(
  envDir: string,
  vars: Record<string, string>,
): Promise<void> {
  if (Object.keys(vars).length === 0) return;
  await writeFile(join(envDir, ".env"), serializeDotenv(vars), {
    mode: 0o600,
  });
}
