import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerInspectMobile } from "./inspectMobile.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const noFlags = {
  by: undefined,
  context: undefined,
  partial: undefined,
  text: undefined,
  x: undefined,
  y: undefined,
};

describe("handleRunnerInspectMobile", () => {
  it.each([
    [
      {
        deviceName: "Pixel 8",
        platformName: "Android",
        sessionId: "abc123",
        type: "ready",
      },
      "Session ready: Android on Pixel 8 (abc123).",
    ],
    [
      { platformName: "iOS", sessionId: "abc123", type: "ready" },
      "Session ready: iOS (abc123).",
    ],
    [
      { error: "ECONNREFUSED", type: "unreachable" },
      "Session unreachable: ECONNREFUSED",
    ],
    [
      { sessionCount: 2, type: "ambiguous" },
      "2 Appium sessions are live; expected one.",
    ],
    [{ type: "no-session" }, "No Appium session is live."],
  ] as const)(
    "summarizes a %o session as %j",
    async (session, humanMessage) => {
      const { callPublicApi, ctx, outputs } = makeAuthCtx();
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { outcome: "success", session, what: "session" },
      });

      expect(
        await handleRunnerInspectMobile(
          ctx,
          { flags: noFlags, runner: "ci", what: "session" },
          makeTestDeps(),
        ),
      ).toBeUndefined();

      expect(callPublicApi).toHaveBeenCalledWith(
        publicContractsV1.runner.inspectMobile,
        { id: "ci", request: { what: "session" } },
        runnerCallOptions,
      );
      expect(outputs()[0]?.humanMessage).toBe(humanMessage);
    },
  );

  it("summarizes the available contexts and the current one", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        contexts: ["NATIVE_APP", "WEBVIEW_1"],
        current: "WEBVIEW_1",
        outcome: "success",
        what: "contexts",
      },
    });

    await handleRunnerInspectMobile(
      ctx,
      { flags: noFlags, runner: "ci", what: "contexts" },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspectMobile,
      { id: "ci", request: { what: "contexts" } },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toBe(
      "2 contexts available; current is WEBVIEW_1.",
    );
    // The value goes out as data too, so --json carries it through.
    expect(outputs()[0]?.data).toMatchObject({ current: "WEBVIEW_1" });
  });

  it("summarizes the page source and carries a named context into the request", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        context: "WEBVIEW_1",
        orientation: "PORTRAIT",
        outcome: "success",
        pageSource: { selectors: [], tag: "body" },
        what: "page",
      },
    });

    await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, context: "WEBVIEW_1" },
        runner: "ci",
        what: "page",
      },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspectMobile,
      { id: "ci", request: { context: "WEBVIEW_1", what: "page" } },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toBe(
      "Read the page source of context WEBVIEW_1 (PORTRAIT).",
    );
  });

  it("summarizes matching elements and carries a point request through", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        matches: [
          { attributes: {}, selectors: [], tag: "android.widget.Button" },
        ],
        outcome: "success",
        what: "elements",
      },
    });

    await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, by: "point", x: "100", y: "200" },
        runner: "ci",
        what: "elements",
      },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspectMobile,
      {
        id: "ci",
        request: { by: "point", what: "elements", x: 100, y: 200 },
      },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toBe("Found 1 matching element.");
  });

  it("refuses an invalid request without addressing a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, by: "point", x: "100" },
        runner: "ci",
        what: "elements",
      },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
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
