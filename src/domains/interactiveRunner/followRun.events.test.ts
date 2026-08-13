import { describe, expect, it } from "bun:test";

import { followRun } from "./followRun.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { makeJournal } from "./journal.testUtils.js";

const inProgress = { runId: "run-a", status: "in-progress" };
const passed = { runId: "run-a", status: "passed" };

const follow = (
  ctx: ReturnType<typeof makeAuthCtx>["ctx"],
  options: { recorderSinceSequence?: number; runEvents?: boolean } = {},
) =>
  followRun(
    ctx,
    {
      logs: false,
      recorderSinceSequence: options.recorderSinceSequence,
      runEvents: options.runEvents ?? false,
      runId: "run-a",
      runnerId: "ci",
      timeoutSeconds: 3600,
    },
    makeTestDeps(),
  );

describe("followRun mirror event streams", () => {
  // JSON lines, not prose: an event payload has no one-line rendering of its
  // own, and JSON is what `qawolf runner events` prints for the same entry. The
  // in-progress line stays out for the same reason: prose among JSON lines
  // hurts a parser.
  it("prints run events as JSON lines, without the in-progress prose", async () => {
    const progress = {
      filePath: "flow.ts",
      runId: "run-a",
      type: "file-completed",
    };
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-events": [[progress]],
        "run-status": [[inProgress], [passed]],
      }),
    );

    expect(await follow(ctx, { runEvents: true })).toBeUndefined();

    expect(streamed()).toEqual([JSON.stringify(progress)]);
    expect(ctx.ui.success).toHaveBeenCalled();
  });

  it("prints recorder events as JSON lines", async () => {
    const click = { locator: "getByRole('button')", type: "click" };
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[click]], "run-status": [[passed]] }),
    );

    expect(await follow(ctx, { recorderSinceSequence: 41 })).toBeUndefined();
    expect(streamed()).toEqual([JSON.stringify(click)]);
  });

  // Recorder entries carry no runId, so the anchor is the only thing keeping a
  // reused runner's whole recorder history out of the follow.
  it("reads the recorder only after its anchor", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [], "run-status": [[passed]] }),
    );

    await follow(ctx, { recorderSinceSequence: 41 });

    const recorderReads = callPublicApi.mock.calls.filter(
      ([, input]) => (input as { stream: string }).stream === "recorder",
    );
    expect(recorderReads.length).toBeGreaterThan(0);
    expect(recorderReads[0]?.[1]).toMatchObject({ sinceSequence: 41 });
    // Unfiltered by run, deliberately: a runId filter on a stream whose entries
    // carry none would silently match nothing.
    expect(recorderReads[0]?.[1]).not.toHaveProperty("runId");
  });
});
