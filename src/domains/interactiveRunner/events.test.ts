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
