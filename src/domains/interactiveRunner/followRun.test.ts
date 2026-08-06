import { describe, expect, it } from "bun:test";

import { followRun } from "./followRun.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { makeJournal } from "./journal.testUtils.js";

const logLine = (message: string) => ({ message, runId: "run-a" });
const inProgress = { runId: "run-a", status: "in-progress" };
const passed = { runId: "run-a", status: "passed" };
const failed = {
  errorMessage: "expected 3 to be 4",
  runId: "run-a",
  status: "failed",
};

const follow = (ctx: ReturnType<typeof makeAuthCtx>["ctx"]) =>
  followRun(ctx, { runId: "run-a", runnerId: "ci" }, makeTestDeps());

describe("followRun", () => {
  it("prints the run's logs and reports it passed", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [[logLine("starting")], [logLine("clicked Sign in")]],
        "run-status": [[inProgress], [passed]],
      }),
    );

    expect(await follow(ctx)).toBeUndefined();

    expect(streamed()).toEqual(["starting", "clicked Sign in"]);
    expect(ctx.ui.success).toHaveBeenCalled();
  });

  // The logs are the output; the status is the answer. A run that prints nothing
  // must still end the follow.
  it("ends on the status even when the run printed nothing", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ "run-logs": [], "run-status": [[passed]] }),
    );

    expect(await follow(ctx)).toBeUndefined();
    expect(streamed()).toEqual([]);
  });

  it("reports how a failed run failed, and exits as a test failure", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ "run-logs": [], "run-status": [[failed]] }),
    );

    expect(await follow(ctx)).toEqual({
      error: "The run failed: expected 3 to be 4",
      exitCode: 1,
    });
  });

  // The settling status and the run's last lines land on different streams, so
  // the status can win the race; stopping at it would cut the output off short
  // of the very failure being reported.
  it("prints log lines that landed after the status was written", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [[], [logLine("expected 3 to be 4")]],
        "run-status": [[failed]],
      }),
    );

    await follow(ctx);

    expect(streamed()).toEqual(["expected 3 to be 4"]);
  });

  // `run-status` cannot cover a pod killed without running its shutdown path, so
  // the runner going unreachable is the only signal such a run is over.
  it("ends the follow when the runner stops answering", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "runner-unreachable" },
    });

    const result = await follow(ctx);

    expect(result?.exitCode).toBe(4);
    expect(result?.error).toContain("could not be reached");
  });

  // The journal keeps a bounded history and drops its oldest entries, so a
  // follow can be handed a window that starts after where it asked to continue
  // from. Printing the rest without saying so hands back a log with a hole in it.
  it("says so when the runner dropped log lines it had not read yet", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal(
        {
          "run-logs": [[logLine("the tail of a busy run")]],
          "run-status": [[passed]],
        },
        { "run-logs": 4001 },
      ),
    );

    await follow(ctx);

    expect(warnings().join(" ")).toContain("4000 entries of run-logs");
  });

  it("says nothing about dropped lines when nothing was dropped", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [[logLine("starting")]],
        "run-status": [[passed]],
      }),
    );

    await follow(ctx);

    expect(warnings()).toEqual([]);
  });

  // Under --json a log message is prose on a stream that owes its reader JSON, so
  // the entry travels beside the rendered line and json mode prints the entry.
  it("hands the whole entry to the renderer alongside the rendered line", async () => {
    const { callPublicApi, ctx, streamedData } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [[logLine("starting")]],
        "run-status": [[passed]],
      }),
    );

    await follow(ctx);

    expect(streamedData()[0]).toMatchObject({
      payload: { message: "starting" },
      sequence: 1,
    });
  });

  it("reports a terminal status it does not recognise rather than polling for ever", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [],
        "run-status": [[{ runId: "run-a", status: "abandoned" }]],
      }),
    );

    const result = await follow(ctx);

    expect(result?.error).toContain("abandoned");
    expect(result?.exitCode).toBe(1);
  });
});
