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
      timeout: undefined,
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
        files: {
          "flow.ts": "export default {};",
          "package.json": "{}",
        },
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
      {
        entryPoint: "flows/missing.ts",
        follow: false,
        runner: "ci",
        timeout: undefined,
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
        runner: "ci",
        timeout: undefined,
      },
      makeTestDeps({
        collectRunFiles: async () => ({ "flow.ts": "export default {};" }),
      }),
    );

    expect(result?.error).toContain("package.json");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // An outcome the CLI does not know must not read as success.
  it("reports an outcome it does not recognize rather than exiting 0", async () => {
    const { result } = await runWith({ outcome: "queued" });

    expect(result?.error).toContain('"queued"');
    expect(result?.exitCode).toBe(4);
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

  // Checking the files costs nothing and resolving a runner may launch and bill
  // one, so a misspelled flow name must be answered before any of that.
  it("refuses a misspelled flow without launching a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps();

    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flows/chekcout.flow.ts",
        follow: false,
        runner: undefined,
        timeout: undefined,
      },
      deps,
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });

  it("refuses a --timeout that is not a positive number of seconds", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerRun(
      ctx,
      { entryPoint: "flow.ts", follow: true, runner: "ci", timeout: "0" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // Following puts the run's journal entries on stdout, so the submitted run goes
  // to stderr instead: two differently shaped objects on one stream would leave a
  // reader sniffing keys to tell which lines are log entries.
  it("announces the submitted run as a diagnostic when following", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({ ok: true, value: submitted })
      .mockResolvedValue({
        ok: true,
        value: {
          entries: [],
          hasUnsearchedHistory: false,
          nextSequence: 1,
          oldestAvailableSequence: 1,
          outcome: "read",
        },
      });

    await handleRunnerRun(
      ctx,
      { entryPoint: "flow.ts", follow: true, runner: "ci", timeout: "1" },
      makeTestDeps(),
    );

    expect(ctx.ui.info).toHaveBeenCalledWith(expect.stringContaining("run-a"));
    expect(outputs()).toEqual([]);
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
      {
        entryPoint: "flow.ts",
        follow: false,
        runner: undefined,
        timeout: undefined,
      },
      makeTestDeps(),
    );

    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("cli-minted"),
    );
    expect(callPublicApi.mock.calls[1]?.[1]).toMatchObject({
      id: "cli-minted",
    });
  });

  // The server's own reason is the only thing that names which file was wrong
  // and what it needed to be, so a refused run has to pass it on rather than
  // leave the caller with a bare status code.
  it("passes on the reason the server gave for refusing the run", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "QA Wolf API runner.runFlow request failed (HTTP 400).",
      errorBody:
        "src/lib/register-pages.ts is not a flow file. A run's entry point must be a flow file under src/flows.",
      ok: false,
    });

    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flow.ts",
        follow: false,
        runner: "ci",
        timeout: undefined,
      },
      makeTestDeps(),
    );

    expect(result?.errorBody).toContain("must be a flow file under src/flows");
    expect(result?.exitCode).toBe(4);
  });
});
