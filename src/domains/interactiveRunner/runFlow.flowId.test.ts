import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const submitted = { outcome: "success" as const, runId: "run-a" };

describe("handleRunnerRun with --flow-id", () => {
  const run = async ({
    env = {},
    flowId,
  }: {
    env?: Record<string, string>;
    flowId?: string;
  }) => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: submitted });
    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flow.ts",
        envFile: undefined,
        envId: undefined,
        flowId,
        follow: false,
        lines: undefined,
        linesFile: undefined,
        logs: false,
        recorderEvents: false,
        runEvents: false,
        runner: "ci",
        timeout: undefined,
      },
      makeTestDeps({
        env,
        collectRunFiles: async () => ({
          files: {
            "flow.ts": "export default {};",
            "package.json": "{}",
          },
          unresolvedImports: [],
        }),
      }),
    );
    return { callPublicApi, result };
  };

  const sentRequest = (callPublicApi: { mock: { calls: unknown[][] } }) =>
    callPublicApi.mock.calls[0]?.[1] ?? {};

  it("names the flow the run is for", async () => {
    const { callPublicApi, result } = await run({ flowId: "flow-7c2e" });

    expect(result).toBeUndefined();
    expect(sentRequest(callPublicApi)).toMatchObject({ flowId: "flow-7c2e" });
  });

  it("trims the id it was given", async () => {
    const { callPublicApi } = await run({ flowId: "  flow-7c2e  " });

    expect(sentRequest(callPublicApi)).toMatchObject({ flowId: "flow-7c2e" });
  });

  it("names no flow when the flag is absent", async () => {
    const { callPublicApi } = await run({});

    expect(Object.hasOwn(sentRequest(callPublicApi), "flowId")).toBe(false);
  });

  // An AI Job's pod exports the id of its own flow, which is not the flow of
  // every run started from that pod. Reading it here would key a run of one
  // flow to another, so the flag is the only source.
  it("ignores a QAWOLF_WORKFLOW_ID in its own environment", async () => {
    const { callPublicApi } = await run({
      env: { QAWOLF_WORKFLOW_ID: "flow-of-this-pod" },
    });

    expect(Object.hasOwn(sentRequest(callPublicApi), "flowId")).toBe(false);
  });

  it("refuses a blank flag before addressing a runner", async () => {
    const { callPublicApi, result } = await run({ flowId: "  " });

    expect(result?.error).toContain("--flow-id was given nothing");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
