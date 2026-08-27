import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

describe("handleRunnerRun file refusals", () => {
  it("refuses a file that is not among the ones that travel, without a request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flows/missing.ts",
        follow: false,
        envFile: undefined,
        envId: undefined,
        lines: undefined,
        linesFile: undefined,
        runner: "ci",
        timeout: undefined,
        logs: false,
        recorderEvents: false,
        runEvents: false,
      },
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
      {
        entryPoint: "flow.ts",
        follow: false,
        envFile: undefined,
        envId: undefined,
        lines: undefined,
        linesFile: undefined,
        runner: "ci",
        timeout: undefined,
        logs: false,
        recorderEvents: false,
        runEvents: false,
      },
      makeTestDeps({
        collectRunFiles: async () => ({
          files: { "flow.ts": "export default {};" },
          unresolvedImports: [],
        }),
      }),
    );

    expect(result?.error).toContain("package.json");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a misspelled flow without launching a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps();

    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flows/chekcout.flow.ts",
        follow: false,
        envFile: undefined,
        envId: undefined,
        lines: undefined,
        linesFile: undefined,
        runner: undefined,
        timeout: undefined,
        logs: false,
        recorderEvents: false,
        runEvents: false,
      },
      deps,
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });
});
