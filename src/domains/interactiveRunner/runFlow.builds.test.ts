import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";
import { sentRequest } from "./runFlow.environment.testUtils.js";

const buildId = "abcdefghij0123456789klmnobld";

async function run(builds: string[]) {
  const { callPublicApi, ctx } = makeAuthCtx();
  callPublicApi.mockResolvedValue({
    ok: true,
    value: { outcome: "success", runId: "run-a" },
  });
  const result = await handleRunnerRun(
    ctx,
    {
      builds,
      entryPoint: "flow.ts",
      envFile: undefined,
      envId: "staging",
      follow: false,
      lines: undefined,
      linesFile: undefined,
      logs: false,
      recorderEvents: false,
      runEvents: false,
      runner: "ci",
      timeout: undefined,
      vars: [],
    },
    makeTestDeps({
      collectRunFiles: async () => ({
        files: { "flow.ts": "export default {};", "package.json": "{}" },
        unresolvedImports: [],
      }),
    }),
  );
  return { callPublicApi, result };
}

describe("handleRunnerRun with --builds", () => {
  it("sends the builds with the environment", async () => {
    const { callPublicApi, result } = await run([buildId]);

    expect(result).toBeUndefined();
    expect(sentRequest(callPublicApi)).toMatchObject({
      builds: [buildId],
      environmentId: "staging",
    });
  });

  it("sends no builds when none are named", async () => {
    const { callPublicApi } = await run([]);

    expect(Object.hasOwn(sentRequest(callPublicApi), "builds")).toBe(false);
  });

  it("refuses a word that is not a build id before addressing a runner", async () => {
    const { callPublicApi, result } = await run([buildId, "flows/a.flow.ts"]);

    expect(result?.error).toBe(
      "✖ Expected a build id from build.requestUpload.\n  → at [1]",
    );
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
