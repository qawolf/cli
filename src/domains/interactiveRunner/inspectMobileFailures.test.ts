import { describe, expect, it } from "bun:test";

import { blankInspectMobileFlags as noFlags } from "~/core/interactiveRunner/inspectMobileRequest.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerInspectMobile } from "./inspectMobile.js";

describe("handleRunnerInspectMobile failures", () => {
  it("refuses an invalid request without addressing a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, x: "100" },
        runner: "ci",
        what: "elements",
      },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("reads failureReason invalid-selector as invalid syntax (exit 2)", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "invalid-selector", outcome: "failure" },
    });

    const result = await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, selector: "not[valid" },
        runner: "ci",
        what: "elements",
      },
      makeTestDeps(),
    );

    expect(result?.error).toContain("syntax");
    expect(result?.exitCode).toBe(2);
  });

  it("never launches a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerInspectMobile(
      ctx,
      { flags: noFlags, runner: undefined, what: "session" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("qawolf runner run");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it.each([
    ["runner-is-not-mobile", "not a mobile device", 2],
    ["screen-needs-a-run", "qawolf runner run", 2],
    ["screen-not-ready", "Retry", 4],
    ["runner-unreachable", "Retry", 4],
  ] as const)(
    "reads failureReason %j as %j (exit %i)",
    async (failureReason, errorSubstring, exitCode) => {
      const { callPublicApi, ctx } = makeAuthCtx();
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { failureReason, outcome: "failure" },
      });

      const result = await handleRunnerInspectMobile(
        ctx,
        { flags: noFlags, runner: "ci", what: "session" },
        makeTestDeps(),
      );

      expect(result?.error).toContain(errorSubstring);
      expect(result?.exitCode).toBe(exitCode);
    },
  );

  it("says it does not recognize an unknown failure reason", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "something-new", outcome: "failure" },
    });

    const result = await handleRunnerInspectMobile(
      ctx,
      { flags: noFlags, runner: "ci", what: "session" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("something-new");
    expect(result?.exitCode).toBe(4);
  });
});
