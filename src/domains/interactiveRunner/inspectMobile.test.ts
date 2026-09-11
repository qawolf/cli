import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { blankInspectMobileFlags as noFlags } from "~/core/interactiveRunner/inspectMobileRequest.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerInspectMobile } from "./inspectMobile.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

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

  // contexts/page/elements print their answer, not a summary: `output` drops
  // `data` at a TTY (human.ts), so a summary sentence would be the only thing
  // a human-mode caller ever saw. `session`'s one-liner above is exempt
  // because it genuinely is the whole answer.
  it("streams the contexts and the current one as JSON, not a summary", async () => {
    const { callPublicApi, ctx, outputs, streamed, streamedData } =
      makeAuthCtx();
    const value = {
      contexts: ["NATIVE_APP", "WEBVIEW_1"],
      current: "WEBVIEW_1",
      outcome: "success",
      what: "contexts",
    };
    callPublicApi.mockResolvedValue({ ok: true, value });

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
    expect(streamed()).toEqual([
      JSON.stringify({
        contexts: ["NATIVE_APP", "WEBVIEW_1"],
        current: "WEBVIEW_1",
      }),
    ]);
    // The full value carries through as data too, for --json.
    expect(streamedData()).toEqual([value]);
    expect(outputs()).toEqual([]);
  });

  it("streams the page source as JSON and carries a named context into the request", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
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
    expect(streamed()).toEqual([
      JSON.stringify({
        context: "WEBVIEW_1",
        orientation: "PORTRAIT",
        pageSource: { selectors: [], tag: "body" },
      }),
    ]);
  });

  it("streams matching elements as JSON and carries a point request through", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    const matches = [
      { attributes: {}, selectors: [], tag: "android.widget.Button" },
    ];
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { matches, outcome: "success", what: "elements" },
    });

    await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, x: "100", y: "200" },
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
    expect(streamed()).toEqual([JSON.stringify({ matches })]);
  });

  it("streams matching elements as JSON and carries a selector request through", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    const matches = [
      { attributes: {}, selectors: [], tag: "android.widget.Button" },
    ];
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { matches, outcome: "success", what: "elements" },
    });

    await handleRunnerInspectMobile(
      ctx,
      {
        flags: { ...noFlags, selector: "//button" },
        runner: "ci",
        what: "elements",
      },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.inspectMobile,
      {
        id: "ci",
        request: {
          by: "selector",
          selector: "//button",
          strategy: "xpath",
          what: "elements",
        },
      },
      runnerCallOptions,
    );
    expect(streamed()).toEqual([JSON.stringify({ matches })]);
  });
});
