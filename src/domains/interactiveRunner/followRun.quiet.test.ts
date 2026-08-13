import { describe, expect, it } from "bun:test";

import { followRun } from "./followRun.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { makeJournal } from "./journal.testUtils.js";

const inProgress = { runId: "run-a", status: "in-progress" };
const passed = { runId: "run-a", status: "passed" };

const follow = (ctx: ReturnType<typeof makeAuthCtx>["ctx"]) =>
  followRun(
    ctx,
    { logs: false, runId: "run-a", runnerId: "ci", timeoutSeconds: 3600 },
    makeTestDeps(),
  );

describe("followRun without --logs, the quiet default", () => {
  it("reports the run's status events and that it passed", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [[{ message: "starting", runId: "run-a" }]],
        "run-status": [[inProgress], [passed]],
      }),
    );

    expect(await follow(ctx)).toBeUndefined();

    expect(streamed()).toEqual(["The run is in progress."]);
    expect(ctx.ui.success).toHaveBeenCalled();
  });

  // Never read, not read-and-dropped: each poll of a stream nothing is printed
  // from would be a wasted request to the runner.
  it("does not read the logs", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(makeJournal({ "run-status": [[passed]] }));

    await follow(ctx);

    const streams = callPublicApi.mock.calls.map(
      ([, input]) => (input as { stream: string }).stream,
    );
    expect(streams).toEqual(["run-status"]);
  });

  // The runner is free to write `in-progress` more than once (a heartbeat, a
  // retry); repeating the line would make the quiet mode noisy again.
  it("reports the run in progress once, however many entries say so", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-status": [[inProgress], [inProgress, inProgress], [passed]],
      }),
    );

    expect(await follow(ctx)).toBeUndefined();
    expect(streamed()).toEqual(["The run is in progress."]);
  });

  // Liveness detection rides on `run-status` alone here, so the unreachable
  // grace window has to work without a second stream answering.
  it("keeps going through a runner that is not answering yet", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-status": ["unreachable", "unreachable", [inProgress], [passed]],
      }),
    );

    expect(await follow(ctx)).toBeUndefined();
    expect(streamed()).toEqual(["The run is in progress."]);
  });

  // Under --json a rendered sentence is prose on a stream that owes its reader
  // JSON, so the status entry travels beside it and json mode prints the entry.
  it("hands the whole status entry to the renderer", async () => {
    const { callPublicApi, ctx, streamedData } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ "run-status": [[inProgress], [passed]] }),
    );

    await follow(ctx);

    expect(streamedData()[0]).toMatchObject({
      payload: { status: "in-progress" },
      sequence: 1,
    });
  });
});
