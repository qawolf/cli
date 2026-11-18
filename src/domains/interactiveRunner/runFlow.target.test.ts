import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";
import { sentRequest } from "./runFlow.environment.testUtils.js";

async function run(target: string | undefined) {
  const { callPublicApi, ctx } = makeAuthCtx();
  callPublicApi.mockResolvedValue({
    ok: true,
    value: { outcome: "success", runId: "run-a" },
  });
  const result = await handleRunnerRun(
    ctx,
    {
      builds: [],
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
      target,
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

describe("handleRunnerRun with --target", () => {
  it("sends the picked target", async () => {
    const { callPublicApi, result } = await run("macOS - Any Mac (macOS 26)");

    expect(result).toBeUndefined();
    expect(sentRequest(callPublicApi)).toMatchObject({
      target: "macOS - Any Mac (macOS 26)",
    });
  });

  it("sends no target when none is named", async () => {
    const { callPublicApi } = await run(undefined);

    expect(Object.hasOwn(sentRequest(callPublicApi), "target")).toBe(false);
  });
});
