import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRecord } from "./recording.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const recordingId = "c41f0990-89d7-44db-a940-2e5425954b29";
const otherId = "b67c8220-0ac9-48a3-944f-5b1cb8397c66";
const url = "https://app.qawolf.com/runners/ci";
const startedAt = "2026-09-22T12:00:00.000Z";
const activeAnswer = {
  result: {
    outcome: "success",
    state: {
      auto: "default",
      active: { id: recordingId, mode: "manual", startedAt },
    },
  },
  url,
};

describe("runner recording", () => {
  it("generates one UUID, starts on the selected runner, and returns its id and history URL", async () => {
    const { ctx, callPublicApi, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: activeAnswer });
    const result = await handleRunnerRecord(
      ctx,
      { runner: "ci", command: { action: "start" } },
      makeTestDeps(),
    );
    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.record,
      {
        id: "ci",
        command: { action: "start", recordingId },
      },
      runnerCallOptions,
    );
    expect(outputs()[0]?.data).toEqual(activeAnswer);
    expect(outputs()[0]?.humanMessage).toContain(recordingId);
    expect(outputs()[0]?.humanMessage).toContain(url);
  });

  it("keeps a supplied UUID across retries", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: activeAnswer });
    for (let attempt = 0; attempt < 2; attempt++) {
      await handleRunnerRecord(
        ctx,
        { runner: "ci", command: { action: "start", recordingId: otherId } },
        makeTestDeps({
          makeRecordingId: () => {
            throw Error("must not generate another id");
          },
        }),
      );
    }
    for (const [, input] of callPublicApi.mock.calls) {
      expect(input).toEqual({
        id: "ci",
        command: { action: "start", recordingId: otherId },
      });
    }
  });

  it("stops exactly the named recording without discovering or replacing its id", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { result: { outcome: "success", state: { auto: "on" } }, url },
    });
    await handleRunnerRecord(
      ctx,
      { runner: "ci", command: { action: "stop", recordingId: otherId } },
      makeTestDeps(),
    );
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      id: "ci",
      command: { action: "stop", recordingId: otherId },
    });
  });

  it.each(["start", "stop"] as const)(
    "rejects a malformed UUID on %s before calling the API",
    async (action) => {
      const { ctx, callPublicApi } = makeAuthCtx();
      const result = await handleRunnerRecord(
        ctx,
        { runner: "ci", command: { action, recordingId: "bad" } },
        makeTestDeps(),
      );
      expect(result?.exitCode).toBe(2);
      expect(callPublicApi).not.toHaveBeenCalled();
    },
  );

  it("never launches a runner implicitly", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    const result = await handleRunnerRecord(
      ctx,
      { runner: undefined, command: { action: "start" } },
      makeTestDeps(),
    );
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("resolves the environment before the stored default, with the flag taking priority", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "environment" } });
    await deps.store.writeDefaultRunnerId("stored");
    callPublicApi.mockResolvedValue({ ok: true, value: activeAnswer });
    for (const runner of [undefined, "flag"]) {
      await handleRunnerRecord(
        ctx,
        { runner, command: { action: "status" } },
        deps,
      );
    }
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { id: "environment", command: { action: "status" } },
      { id: "flag", command: { action: "status" } },
    ]);
  });

  it.each([true, false])(
    "sends auto enabled=%s without starting a run",
    async (enabled) => {
      const { ctx, callPublicApi } = makeAuthCtx();
      callPublicApi.mockResolvedValue({ ok: true, value: activeAnswer });
      await handleRunnerRecord(
        ctx,
        { runner: "ci", command: { action: "auto", enabled } },
        makeTestDeps(),
      );
      expect(callPublicApi).toHaveBeenCalledTimes(1);
      expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
        id: "ci",
        command: { action: "auto", enabled },
      });
    },
  );

  it.each([
    ["unsupported", 2],
    ["screen-not-ready", 2],
    ["recording-in-progress", 2],
    ["recording-not-found", 8],
    ["recording-id-used", 2],
    ["runner-unreachable", 4],
    ["recording-failed", 1],
  ])(
    "exits nonzero for the nested %s failure",
    async (failureReason, exitCode) => {
      const { ctx, callPublicApi, outputs } = makeAuthCtx();
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { result: { outcome: "failure", failureReason }, url },
      });
      const result = await handleRunnerRecord(
        ctx,
        { runner: "ci", command: { action: "start" } },
        makeTestDeps(),
      );
      expect(result?.exitCode).toBe(exitCode);
      expect(result?.errorBody).toContain(recordingId);
      expect(outputs()).toEqual([]);
    },
  );

  it("returns the generated UUID when the response is lost, without retrying", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: false,
      error: "Connection lost",
      mayHaveArrived: true,
    });
    const result = await handleRunnerRecord(
      ctx,
      { runner: "ci", command: { action: "start" } },
      makeTestDeps(),
    );
    expect(result?.error).toBe("Connection lost");
    expect(result?.exitCode).toBe(4);
    expect(result?.errorBody).toContain(recordingId);
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });
});
