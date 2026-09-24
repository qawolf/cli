import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRecordings } from "./recording.js";

const recordingId = "c41f0990-89d7-44db-a940-2e5425954b29";
const recording = {
  id: recordingId,
  mode: "manual",
  status: "ready",
  startedAt: "2026-09-22T12:00:00.000Z",
  endedAt: "2026-09-22T12:01:00.000Z",
  runnerId: "terminated",
  runnerInstanceId: recordingId,
  runIds: ["run-1"],
  version: 1,
  url: "https://app.qawolf.com/runners/terminated/recordings/example",
  videoUrl: "https://example.com/video.mp4",
};

describe("recording history", () => {
  it("asks for the original runner id after termination clears the default", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("terminated");
    await deps.store.forgetRunner("terminated");

    const result = await handleRunnerRecordings(
      ctx,
      { runner: undefined },
      deps,
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("--runner <id>");
    expect(result?.error).toContain("QAWOLF_RUNNER_ID");
    expect(result?.error).toContain("after the runner terminates");
    expect(result?.error).not.toContain("launch");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("reads storage directly for a terminated runner, preserving both links and the next page", async () => {
    const { ctx, callPublicApi, outputs } = makeAuthCtx();
    const answer = { recordings: [recording], nextPageToken: "next-page" };
    callPublicApi.mockResolvedValue({ ok: true, value: answer });
    await handleRunnerRecordings(ctx, { runner: "terminated" }, makeTestDeps());
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.recordings,
      { id: "terminated" },
    );
    expect(outputs()[0]?.data).toEqual(answer);
    for (const value of [
      recording.url,
      recording.videoUrl,
      "--page-token",
      "next-page",
    ]) {
      expect(outputs()[0]?.humanMessage).toContain(value);
    }
  });

  it("passes a lookup UUID and opaque cursor unchanged", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: { recordings: [] } });
    await handleRunnerRecordings(
      ctx,
      { runner: "ci", recordingId, pageToken: "token/+=abc" },
      makeTestDeps(),
    );
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      id: "ci",
      recordingId,
      pageToken: "token/+=abc",
    });
  });

  it("treats unpublished or absent recordings as an empty page", async () => {
    const { ctx, callPublicApi, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: { recordings: [] } });
    expect(
      await handleRunnerRecordings(
        ctx,
        { runner: "ci", recordingId },
        makeTestDeps(),
      ),
    ).toBeUndefined();
    expect(outputs()[0]?.data).toEqual({ recordings: [] });
    expect(outputs()[0]?.humanMessage).toBe("No published recordings found.");
  });

  it("displays failed recordings without inventing a video link", async () => {
    const { ctx, callPublicApi, outputs } = makeAuthCtx();
    const { videoUrl: _videoUrl, ...failed } = recording;
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { recordings: [{ ...failed, status: "failed" }] },
    });
    await handleRunnerRecordings(ctx, { runner: "ci" }, makeTestDeps());
    expect(outputs()[0]?.humanMessage).toContain("failed");
    expect(outputs()[0]?.humanMessage).not.toContain("Video:");
  });

  it.each([{ recordingId: "bad" }, { pageToken: "x".repeat(4097) }])(
    "rejects invalid filters locally",
    async (query) => {
      const { ctx, callPublicApi } = makeAuthCtx();
      const result = await handleRunnerRecordings(
        ctx,
        { runner: "ci", ...query },
        makeTestDeps(),
      );
      expect(result?.exitCode).toBe(2);
      expect(callPublicApi).not.toHaveBeenCalled();
    },
  );

  it("preserves an authentication failure", async () => {
    const { ctx, callPublicApi } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: false,
      error: "Unauthorized",
      exitCode: 3,
    });
    const result = await handleRunnerRecordings(
      ctx,
      { runner: "ci" },
      makeTestDeps(),
    );
    expect(result).toEqual({ error: "Unauthorized", exitCode: 3 });
  });
});
