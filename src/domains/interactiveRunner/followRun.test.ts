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

const follow = (
  ctx: ReturnType<typeof makeAuthCtx>["ctx"],
  options: {
    logs?: boolean;
    recorderSinceSequence?: number;
    runEvents?: boolean;
    timeoutSeconds?: number;
  } = {},
) =>
  followRun(
    ctx,
    {
      logs: options.logs ?? false,
      recorderSinceSequence: options.recorderSinceSequence,
      runEvents: options.runEvents ?? false,
      runId: "run-a",
      runnerId: "ci",
      timeoutSeconds: options.timeoutSeconds ?? 3600,
    },
    makeTestDeps(),
  );

// The quiet default lives in followRun.quiet.test.ts; this file covers the
// --logs follow and what both modes share: settlement, unreachability, timeout.
describe("followRun", () => {
  it("prints the run's logs when asked for them", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [[logLine("starting")], [logLine("clicked Sign in")]],
        "run-status": [[inProgress], [passed]],
      }),
    );

    expect(await follow(ctx, { logs: true })).toBeUndefined();

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

    expect(await follow(ctx, { logs: true })).toBeUndefined();
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

    await follow(ctx, { logs: true });

    expect(streamed()).toEqual(["expected 3 to be 4"]);
  });

  // `run-status` cannot cover a pod killed without running its shutdown path, so
  // a runner that keeps failing to answer is the only signal such a run is over.
  it("ends the follow when the runner stops answering for good", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await follow(ctx);

    expect(result?.exitCode).toBe(4);
    expect(result?.error).toContain("could not be reached");
  });

  // The first read of a run lands while the pod is still installing dependencies
  // and starting its browser, which the contract answers `runner-unreachable` and
  // calls transient. Giving up on it reports a run that is starting normally as a
  // failed one.
  it("keeps following through a runner that is not answering yet", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": ["unreachable", "unreachable", [logLine("starting")]],
        "run-status": ["unreachable", "unreachable", [passed]],
      }),
    );

    expect(await follow(ctx, { logs: true })).toBeUndefined();
    expect(streamed()).toEqual(["starting"]);
  });

  // The journal keeps a bounded history and drops its oldest entries, so a
  // follow can be handed a window that starts after where it asked to continue
  // from. Printing the rest without saying so hands back a log with a hole in it.
  it("says so when the runner dropped log lines it had not read yet", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        "run-logs": [
          [logLine("starting")],
          { oldestAvailableSequence: 4001, payloads: [logLine("the tail")] },
        ],
        "run-status": [[inProgress], [passed]],
      }),
    );

    await follow(ctx, { logs: true });

    expect(warnings().join(" ")).toContain("3999 entries of run-logs");
  });

  // The settlement is known by then, so a flush of the output must not
  // override the run's outcome — but silence would misreport a cut-off log.
  it("warns when the final mirror read fails, and keeps the settlement", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    let logReads = 0;
    const journal = makeJournal({ "run-status": [[passed]] });
    callPublicApi.mockImplementation((contract, input) => {
      const stream = (input as { stream: string }).stream;
      if (stream === "run-logs" && ++logReads === 2) {
        return Promise.resolve({ error: "HTTP 500", ok: false });
      }
      return journal(contract, input);
    });

    expect(await follow(ctx, { logs: true })).toBeUndefined();

    expect(ctx.ui.success).toHaveBeenCalled();
    expect(warnings().join(" ")).toContain("missing its final lines");
  });

  it("gives up on a run that never settles, and says the run may still be going", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ "run-logs": [], "run-status": [[inProgress]] }),
    );

    const result = await follow(ctx, { timeoutSeconds: 3 });

    expect(result?.exitCode).toBe(6);
    expect(result?.error).toContain("may still be going");
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

    await follow(ctx, { logs: true });

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
