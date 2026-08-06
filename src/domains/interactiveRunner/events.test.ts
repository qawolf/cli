import { describe, expect, it } from "bun:test";

import { handleRunnerEvents } from "./events.js";
import { makeJournal } from "./journal.testUtils.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const baseOptions = {
  envelope: false,
  follow: false,
  run: undefined,
  runner: "ci",
  since: undefined,
  stream: "recorder",
  tail: undefined,
};

describe("handleRunnerEvents", () => {
  it("prints one payload per line", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({
        recorder: [[{ code: 'click("Sign in")' }, { code: "fill()" }]],
      }),
    );

    expect(
      await handleRunnerEvents(ctx, baseOptions, makeTestDeps()),
    ).toBeUndefined();

    expect(streamed()).toEqual([
      '{"code":"click(\\"Sign in\\")"}',
      '{"code":"fill()"}',
    ]);
  });

  it("prints the whole envelope when the caller asked for JSON", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[{ code: "x" }]] }),
    );

    await handleRunnerEvents(
      ctx,
      { ...baseOptions, envelope: true },
      makeTestDeps(),
    );

    expect(JSON.parse(streamed()[0] ?? "")).toMatchObject({
      payload: { code: "x" },
      sequence: 1,
    });
  });

  it("passes the read filters through to the journal", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(makeJournal({ "run-logs": [[]] }));

    await handleRunnerEvents(
      ctx,
      {
        ...baseOptions,
        run: "run-a",
        since: "12",
        stream: "run-logs",
        tail: "5",
      },
      makeTestDeps(),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      id: "ci",
      runId: "run-a",
      sinceSequence: 12,
      stream: "run-logs",
      tail: 5,
    });
  });

  // Re-applying the tail on every poll would skip entries that arrived between
  // them, so the cursor takes over once there is one.
  it("follows from the cursor rather than re-tailing", async () => {
    const { callPublicApi, ctx, streamed } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[{ code: "a" }], [{ code: "b" }]] }),
    );

    // A follow is endless by design, so the injected sleep is what ends it:
    // it throws once both scripted reads have been printed.
    const stopFollowing = "stop following";
    try {
      await handleRunnerEvents(
        ctx,
        { ...baseOptions, follow: true, tail: "1" },
        makeTestDeps({
          sleep: async () => {
            if (streamed().length >= 2) throw Error(stopFollowing);
          },
        }),
      );
    } catch (error) {
      expect((error as Error).message).toBe(stopFollowing);
    }

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({ tail: 1 });
    expect(callPublicApi.mock.calls[1]?.[1]).toMatchObject({
      sinceSequence: 1,
    });
    expect(callPublicApi.mock.calls[1]?.[1]).not.toHaveProperty("tail");
  });

  // Follow-up polls read against a cursor, and the journal's history is bounded:
  // a follow that falls behind is handed a window starting after where it asked
  // to continue from, and the entries in between are gone.
  it("says so when entries were dropped before the read it asked for", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[{ code: "a" }]] }, { recorder: 91 }),
    );

    await handleRunnerEvents(
      ctx,
      { ...baseOptions, since: "10" },
      makeTestDeps(),
    );

    expect(warnings().join(" ")).toContain("80 entries of recorder");
  });

  // A first read with no cursor starts at the oldest available entry by
  // definition, so there is nothing to have missed and nothing to warn about.
  it("says nothing about dropped entries when no cursor was given", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[{ code: "a" }]] }, { recorder: 91 }),
    );

    await handleRunnerEvents(ctx, baseOptions, makeTestDeps());

    expect(warnings()).toEqual([]);
  });

  it("refuses a stream name that could address a path outside the journal", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, stream: "../secrets" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // A run id addresses a directory on the runner just as a stream name does, so
  // it is held to the published bound rather than passed through unchecked.
  it("refuses a run id the published schema does not admit", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, run: "r".repeat(200), stream: "run-logs" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a tail that is not a positive count", async () => {
    const { ctx } = makeAuthCtx();

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, tail: "many" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
  });

  // Starting and billing a pod in order to print no lines would serve nobody.
  it("never launches a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, runner: undefined },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
