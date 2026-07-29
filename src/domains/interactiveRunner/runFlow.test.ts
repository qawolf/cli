import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerRun } from "./runFlow.js";
import { makeAuthCtx, makeTestDeps, testCwd } from "./deps.testUtils.js";

const submitted = { outcome: "submitted" as const, runId: "run-a" };

async function runWith(
  value: unknown,
  options: { entryPoint?: string } = {},
): Promise<{
  ctx: ReturnType<typeof makeAuthCtx>["ctx"];
  callPublicApi: ReturnType<typeof makeAuthCtx>["callPublicApi"];
  result: Awaited<ReturnType<typeof handleRunnerRun>>;
}> {
  const { callPublicApi, ctx } = makeAuthCtx();
  callPublicApi.mockResolvedValue({ ok: true, value });
  const result = await handleRunnerRun(
    ctx,
    {
      entryPoint: options.entryPoint ?? "flow.ts",
      follow: false,
      runner: "ci",
    },
    makeTestDeps(),
  );
  return { callPublicApi, ctx, result };
}

describe("handleRunnerRun", () => {
  it("ships the collected files and reports the run id", async () => {
    const { callPublicApi, result } = await runWith(submitted);

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.runFlow,
      {
        entryPointPath: "flow.ts",
        files: [
          { content: "{}", path: "package.json" },
          { content: "export default {};", path: "flow.ts" },
        ],
        id: "ci",
      },
    );
  });

  it("names the entry point by the path it travels under, from an absolute path", async () => {
    const { callPublicApi } = await runWith(submitted, {
      entryPoint: `${testCwd}/flow.ts`,
    });

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      entryPointPath: "flow.ts",
    });
  });

  it("refuses a file that is not among the ones that travel, without a request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerRun(
      ctx,
      { entryPoint: "flows/missing.ts", follow: false, runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("flows/missing.ts");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a directory carrying no package.json, without a request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerRun(
      ctx,
      { entryPoint: "flow.ts", follow: false, runner: "ci" },
      makeTestDeps({
        collectRunFiles: async () => [
          { content: "export default {};", path: "flow.ts" },
        ],
      }),
    );

    expect(result?.error).toContain("package.json");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("names both images when the runner is the wrong one for the flow", async () => {
    const { result } = await runWith({
      outcome: "runner-target-mismatch",
      requiredRunnerName: "node20WithAndroid",
      runnerName: "node20WithPlaywright",
    });

    expect(result?.error).toContain("node20WithAndroid");
    expect(result?.error).toContain("node20WithPlaywright");
    expect(result?.exitCode).toBe(2);
  });

  // Resubmitting would bill a second run, so the message says to read the
  // journal rather than to retry.
  it("does not invite a retry when the submission answer was lost", async () => {
    const { result } = await runWith({ outcome: "runner-unreachable" });

    expect(result?.error).toContain("does not mean the run did not start");
    expect(result?.exitCode).toBe(4);
  });

  it("announces the runner it had to launch, naming it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({
        ok: true,
        value: {
          gpuAccelerated: false,
          id: "cli-minted",
          outcome: "launched",
          runnerName: "node20WithPlaywright",
        },
      })
      .mockResolvedValueOnce({ ok: true, value: submitted });

    await handleRunnerRun(
      ctx,
      { entryPoint: "flow.ts", follow: false, runner: undefined },
      makeTestDeps(),
    );

    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("cli-minted"),
    );
    expect(callPublicApi.mock.calls[1]?.[1]).toMatchObject({
      id: "cli-minted",
    });
  });
});
