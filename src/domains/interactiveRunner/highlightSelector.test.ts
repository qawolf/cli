import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerHighlightSelector } from "./highlightSelector.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

describe("handleRunnerHighlightSelector", () => {
  it("highlights what the selector matched and says where to see it", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        matchCount: 3,
        outcome: "success",
        selector: "text=Sign in",
        status: "valid",
      },
    });

    expect(
      await handleRunnerHighlightSelector(
        ctx,
        { runner: "ci", selector: "text=Sign in" },
        makeTestDeps(),
      ),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.highlightSelector,
      { id: "ci", selector: "text=Sign in" },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toContain("3 elements");
  });

  it("names the page when the match was not on the default one", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        matchCount: 1,
        outcome: "success",
        selector: "#checkout",
        status: "valid",
        targetPage: "popup-2",
      },
    });

    await handleRunnerHighlightSelector(
      ctx,
      { runner: "ci", selector: "#checkout" },
      makeTestDeps(),
    );

    expect(outputs()[0]?.humanMessage).toContain("popup-2");
  });

  it("reports a selector that matched nothing without failing", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        matchCount: 0,
        outcome: "success",
        selector: "#gone",
        status: "empty",
      },
    });

    expect(
      await handleRunnerHighlightSelector(
        ctx,
        { runner: "ci", selector: "#gone" },
        makeTestDeps(),
      ),
    ).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("nothing matched");
  });

  it("fails on a selector the page could not read", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        matchCount: 0,
        outcome: "success",
        selector: "((",
        status: "invalid",
      },
    });

    const result = await handleRunnerHighlightSelector(
      ctx,
      { runner: "ci", selector: "((" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("could not read");
  });

  it("clears the highlight when no selector is given", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "cleared" },
    });

    expect(
      await handleRunnerHighlightSelector(
        ctx,
        { runner: "ci", selector: undefined },
        makeTestDeps(),
      ),
    ).toBeUndefined();

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      id: "ci",
      selector: "",
    });
    expect(outputs()[0]?.humanMessage).toContain("Cleared");
  });

  it.each([
    ["no-answer", 4, "did not answer"],
    ["runner-cannot-highlight-selectors", 2, "no browser to draw on"],
    ["runner-unreachable", 4, "could not be reached"],
  ])("reports %s", async (failureReason, exitCode, text) => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason, outcome: "failure" },
    });

    const result = await handleRunnerHighlightSelector(
      ctx,
      { runner: "ci", selector: "#a" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCode);
    expect(result?.error).toContain(text);
  });
});
