import { describe, expect, it } from "bun:test";

import { handleRunnerRun } from "./runFlow.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { makeJournal } from "./journal.testUtils.js";

const submitted = { outcome: "success" as const, runId: "run-a" };

const runFollowing = (
  ctx: ReturnType<typeof makeAuthCtx>["ctx"],
  options: {
    follow?: boolean;
    launch?: boolean;
    logs?: boolean;
    recorderEvents?: boolean;
    runEvents?: boolean;
    timeout?: string;
  } = {},
) =>
  handleRunnerRun(
    ctx,
    {
      entryPoint: "flow.ts",
      follow: options.follow ?? true,
      logs: options.logs ?? false,
      recorderEvents: options.recorderEvents ?? false,
      runEvents: options.runEvents ?? false,
      runner: options.launch ? undefined : "ci",
      timeout: options.timeout ?? "1",
    },
    makeTestDeps(),
  );

const wasSubmitted = (
  callPublicApi: ReturnType<typeof makeAuthCtx>["callPublicApi"],
) =>
  callPublicApi.mock.calls.some(
    ([, input]) => (input as { entryPointPath?: string }).entryPointPath,
  );

describe("handleRunnerRun --follow", () => {
  it("refuses a --timeout that is not a positive number of seconds", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await runFollowing(ctx, { timeout: "0" });

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // Following puts the run's journal entries on stdout, so the submitted run goes
  // to stderr instead: two differently shaped objects on one stream would leave a
  // reader sniffing keys to tell which lines are log entries.
  it("announces the submitted run as a diagnostic when following", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({ ok: true, value: submitted })
      .mockImplementation(makeJournal({}));

    await runFollowing(ctx);

    expect(ctx.ui.info).toHaveBeenCalledWith(expect.stringContaining("run-a"));
    expect(outputs()).toEqual([]);
  });

  // A stream flag only chooses what a follow prints, so alone it can only mean
  // "follow, with that stream".
  for (const streamFlag of ["logs", "recorderEvents", "runEvents"] as const) {
    it(`follows when --${streamFlag} is given without --follow`, async () => {
      const { callPublicApi, ctx } = makeAuthCtx();
      // Dispatched on the input rather than call order: --recorder-events reads
      // its anchor before the submission happens.
      const journal = makeJournal({
        "run-status": [[{ runId: "run-a", status: "passed" }]],
      });
      callPublicApi.mockImplementation((contract, input) =>
        (input as { stream?: string }).stream === undefined
          ? Promise.resolve({ ok: true, value: submitted })
          : journal(contract, input),
      );

      const result = await runFollowing(ctx, {
        follow: false,
        [streamFlag]: true,
      });

      expect(result).toBeUndefined();
      expect(ctx.ui.success).toHaveBeenCalled();
    });
  }

  // Recorder entries carry no runId, so this run's events are "everything after
  // the anchor" — and an anchor taken after submission could sit past the run's
  // first events.
  it("anchors the recorder before submitting the run", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({
        ok: true,
        value: {
          entries: [],
          hasUnsearchedHistory: false,
          nextSequence: 7,
          oldestAvailableSequence: 1,
          outcome: "read",
        },
      })
      .mockResolvedValueOnce({ ok: true, value: submitted })
      .mockImplementation(
        makeJournal({
          "run-status": [[{ runId: "run-a", status: "passed" }]],
        }),
      );

    await runFollowing(ctx, { recorderEvents: true });

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      stream: "recorder",
      tail: 1,
    });
    const recorderFollowReads = callPublicApi.mock.calls
      .slice(2)
      .filter(
        ([, input]) => (input as { stream?: string }).stream === "recorder",
      );
    expect(recorderFollowReads[0]?.[1]).toMatchObject({ sinceSequence: 7 });
  });

  // A runner this command just launched has a provably empty journal, so asking
  // it for an anchor would only wait out its boot for a knowable answer.
  it("anchors a runner it just launched at the start, without asking it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const journal = makeJournal({
      "run-status": [[{ runId: "run-a", status: "passed" }]],
    });
    callPublicApi
      .mockResolvedValueOnce({
        ok: true,
        value: {
          gpuAccelerated: false,
          id: "cli-minted",
          alreadyRunning: false,
          outcome: "success",
          runnerName: "playwright",
        },
      })
      .mockImplementation((contract, input) =>
        (input as { stream?: string }).stream === undefined
          ? Promise.resolve({ ok: true, value: submitted })
          : journal(contract, input),
      );

    await runFollowing(ctx, { launch: true, recorderEvents: true });

    const anchorReads = callPublicApi.mock.calls.filter(
      ([, input]) => (input as { tail?: number }).tail === 1,
    );
    expect(anchorReads).toEqual([]);
    const recorderReads = callPublicApi.mock.calls.filter(
      ([, input]) => (input as { stream?: string }).stream === "recorder",
    );
    expect(recorderReads[0]?.[1]).toMatchObject({ sinceSequence: 0 });
  });

  // Unreachable can mean a reused runner too busy to answer, and guessing an
  // anchor of zero would replay its whole recorder history as this run's
  // actions. The anchor waits like the follow does.
  it("keeps asking a reused runner for its anchor until it answers", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const journal = makeJournal({
      "run-status": [[{ runId: "run-a", status: "passed" }]],
    });
    let anchorReads = 0;
    callPublicApi.mockImplementation((contract, input) => {
      const request = input as { stream?: string; tail?: number };
      if (request.tail === 1) {
        anchorReads++;
        return Promise.resolve(
          anchorReads === 1
            ? {
                ok: true,
                value: {
                  failureReason: "runner-unreachable",
                  outcome: "failure",
                },
              }
            : {
                ok: true,
                value: {
                  entries: [],
                  hasUnsearchedHistory: false,
                  nextSequence: 7,
                  oldestAvailableSequence: 1,
                  outcome: "read",
                },
              },
        );
      }
      if (request.stream === undefined) {
        return Promise.resolve({ ok: true, value: submitted });
      }
      return journal(contract, input);
    });

    expect(await runFollowing(ctx, { recorderEvents: true })).toBeUndefined();
    expect(anchorReads).toBe(2);
  });

  // Nothing has been submitted or billed yet at anchor time, so a runner that
  // will not answer fails the command rather than starting a run whose recorder
  // follow is already broken.
  it("fails without submitting when a reused runner never answers its anchor", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await runFollowing(ctx, { recorderEvents: true });

    expect(result?.exitCode).toBe(4);
    expect(wasSubmitted(callPublicApi)).toBe(false);
  });

  it("fails without submitting when the anchor read fails outright", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "QA Wolf API runner.readJournal request failed (HTTP 500).",
      ok: false,
    });

    const result = await runFollowing(ctx, { recorderEvents: true });

    expect(result?.error).toContain("readJournal");
    expect(wasSubmitted(callPublicApi)).toBe(false);
  });
});
