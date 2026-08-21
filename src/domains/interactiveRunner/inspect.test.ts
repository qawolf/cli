import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerInspect } from "./inspect.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const noFlags = { name: undefined, selector: undefined };

describe("handleRunnerInspect", () => {
  it("asks for an element's html and prints it on its own", async () => {
    const { callPublicApi, ctx, outputs, streamed } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", value: "<input id='email'>" },
    });

    expect(
      await handleRunnerInspect(
        ctx,
        {
          flags: { name: undefined, selector: "#email" },
          runner: "ci",
          what: "element-html",
        },
        makeTestDeps(),
      ),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspect,
      { id: "ci", request: { selector: "#email", what: "element-html" } },
      runnerCallOptions,
    );
    // The value and nothing else, so a caller can redirect it into a file.
    expect(streamed()).toEqual(["<input id='email'>"]);
    expect(outputs()).toEqual([]);
  });

  it("asks for the whole page when no selector narrows it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", value: "<html></html>" },
    });

    await handleRunnerInspect(
      ctx,
      { flags: noFlags, runner: "ci", what: "page-html" },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspect,
      { id: "ci", request: { what: "page-html" } },
      runnerCallOptions,
    );
  });

  it("asks for a variable by name", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", value: '{"total":42}' },
    });

    await handleRunnerInspect(
      ctx,
      {
        flags: { name: "cart", selector: undefined },
        runner: "ci",
        what: "variable",
      },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspect,
      { id: "ci", request: { variableName: "cart", what: "variable" } },
      runnerCallOptions,
    );
    expect(streamed()).toEqual(['{"total":42}']);
  });

  it("refuses a selector over the published limit without addressing a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerInspect(
      ctx,
      {
        flags: { name: undefined, selector: "a".repeat(2_001) },
        runner: "ci",
        what: "element-html",
      },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("never launches a runner, and says a page comes from a run", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerInspect(
      ctx,
      { flags: noFlags, runner: undefined, what: "page-html" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("qawolf runner run");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // Waiting clears none of the three conditions behind this reason, so it must
  // not read as something to retry.
  it("reads nothing-to-inspect as needing the caller to act", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "nothing-to-inspect", outcome: "failure" },
    });

    const result = await handleRunnerInspect(
      ctx,
      {
        flags: { name: undefined, selector: "#gone" },
        runner: "ci",
        what: "element-html",
      },
      makeTestDeps(),
    );

    expect(result?.error).toContain("nothing to inspect");
    expect(result?.exitCode).toBe(2);
  });

  it("passes on what the runner said when it said anything", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "no live page",
        failureReason: "nothing-to-inspect",
        outcome: "failure",
      },
    });

    const result = await handleRunnerInspect(
      ctx,
      { flags: noFlags, runner: "ci", what: "page-html" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("no live page");
  });

  it("reads an unreachable runner as worth retrying", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerInspect(
      ctx,
      { flags: noFlags, runner: "ci", what: "page-html" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("Retry");
    expect(result?.exitCode).toBe(4);
  });

  it("carries the value as data too, for --json", async () => {
    const { callPublicApi, ctx, streamedData } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", value: "<html></html>" },
    });

    await handleRunnerInspect(
      ctx,
      { flags: noFlags, runner: "ci", what: "page-html" },
      makeTestDeps(),
    );

    expect(streamedData()).toEqual([
      { outcome: "success", value: "<html></html>" },
    ]);
  });
});
