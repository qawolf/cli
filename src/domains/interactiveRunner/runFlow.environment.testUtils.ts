import { basename } from "node:path";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const submitted = { outcome: "success" as const, runId: "run-a" };

const envFileDeps = (content: string, env: Record<string, string> = {}) =>
  makeTestDeps({
    env,
    collectRunFiles: async () => ({
      files: {
        "flow.ts": "export default {};",
        "package.json": "{}",
      },
      unresolvedImports: [],
    }),
    readFile: async (path) => {
      if (basename(path) === ".env") return content;
      throw Error(`no such file: ${path}`);
    },
  });

export const runWithEnvironment = async ({
  content = 'A="1"\n',
  env,
  envFile,
  envId,
  vars = [],
}: {
  content?: string;
  env?: Record<string, string>;
  envFile?: string;
  envId?: string;
  vars?: string[];
}) => {
  const { callPublicApi, ctx, infos } = makeAuthCtx();
  callPublicApi.mockResolvedValue({ ok: true, value: submitted });
  const result = await handleRunnerRun(
    ctx,
    {
      entryPoint: "flow.ts",
      envFile,
      envId,
      follow: false,
      lines: undefined,
      linesFile: undefined,
      logs: false,
      recorderEvents: false,
      runEvents: false,
      runner: "ci",
      timeout: undefined,
      vars,
    },
    envFileDeps(content, env),
  );
  return { callPublicApi, infos, result };
};

export const sentRequest = (callPublicApi: { mock: { calls: unknown[][] } }) =>
  callPublicApi.mock.calls[0]?.[1] ?? {};
