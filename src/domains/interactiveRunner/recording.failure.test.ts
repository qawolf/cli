import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRecord } from "./recording.js";

const recordingId = "c41f0990-89d7-44db-a940-2e5425954b29";
const url = "https://app.qawolf.com/runners/ci";

describe("recording completion failures", () => {
  for (const mode of ["human", "json", "agent"] as const) {
    it(`reports a failed video even when stop succeeded, in ${mode} mode`, async () => {
      const { ctx, callPublicApi, outputs } = makeAuthCtx(mode);
      const answer = {
        result: {
          outcome: "success",
          state: { auto: "default" },
          recording: {
            id: recordingId,
            runnerId: "ci",
            runnerInstanceId: recordingId,
            mode: "manual",
            status: "failed",
            startedAt: "2026-09-22T12:00:00.000Z",
            endedAt: "2026-09-22T12:01:00.000Z",
            runIds: ["run-1"],
            version: 1,
          },
        },
        url,
      };
      callPublicApi.mockResolvedValue({ ok: true, value: answer });

      const result = await handleRunnerRecord(
        ctx,
        { runner: "ci", command: { action: "stop", recordingId } },
        makeTestDeps(),
      );

      expect(result?.exitCode).toBe(1);
      expect(result?.error).toContain("failed");
      expect(result?.error).not.toContain("retry");
      expect(result?.errorBody).toContain(recordingId);
      expect(result?.errorBody).toContain(url);
      // Keep the manifest available to JSON consumers even on a failed capture.
      expect(outputs()[0]?.data).toEqual(answer);
      expect(callPublicApi).toHaveBeenCalledTimes(1);
    });
  }

  it("keeps the stop UUID and explains how to retry incomplete publication", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        result: { outcome: "failure", failureReason: "recording-failed" },
        url,
      },
    });
    const result = await handleRunnerRecord(
      ctx,
      { runner: "ci", command: { action: "stop", recordingId } },
      makeTestDeps(),
    );
    expect(result?.exitCode).toBe(1);
    expect(result?.error).toContain("retry it with the same recording id");
    expect(result?.errorBody).toContain(recordingId);
  });

  it("explains that an automatic recording must finish with its run", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        result: { outcome: "failure", failureReason: "recording-in-progress" },
        url,
      },
    });

    const result = await handleRunnerRecord(
      ctx,
      { runner: "ci", command: { action: "start" } },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("manual");
    expect(result?.error).toContain("automatic");
    expect(result?.error).toContain("run to finish");
  });
});
