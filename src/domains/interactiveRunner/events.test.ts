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
  timeout: undefined,
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

  // A stream name is a path segment rather than a closed set, so a typo is a
  // legal read that returns nothing — which looks exactly like an empty stream.
  it("says so when asked for a stream QA Wolf does not write", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(makeJournal({}));

    await handleRunnerEvents(
      ctx,
      { ...baseOptions, stream: "consle" },
      makeTestDeps(),
    );

    expect(warnings().join(" ")).toContain("not a stream QA Wolf writes");
  });

  it("says nothing about the stream name when it is one QA Wolf writes", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ console: [[{ text: "x" }]] }),
    );

    await handleRunnerEvents(
      ctx,
      { ...baseOptions, stream: "console" },
      makeTestDeps(),
    );

    expect(warnings()).toEqual([]);
  });

  // A single read has nothing to retry with, so it reports the unreachable runner
  // rather than polling one the caller never asked it to wait for.
  it("reports an unreachable runner rather than retrying when not following", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: ["unreachable"] }),
    );

    const result = await handleRunnerEvents(ctx, baseOptions, makeTestDeps());

    expect(result?.exitCode).toBe(4);
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });

  it("keeps following through a runner that is briefly unreachable", async () => {
    const { callPublicApi, ctx, streamedData } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: ["unreachable", [{ code: "a" }]] }),
    );

    const stopFollowing = "stop following";
    try {
      await handleRunnerEvents(
        ctx,
        { ...baseOptions, follow: true },
        makeTestDeps({
          sleep: async () => {
            if (streamedData().length >= 1) throw Error(stopFollowing);
          },
        }),
      );
    } catch (error) {
      expect((error as Error).message).toBe(stopFollowing);
    }

    expect(streamedData()).toEqual([{ code: "a" }]);
  });

  // A follow keeps the runner alive and billing, so it has to end on its own
  // rather than only when the terminal closes.
  it("gives up following at --timeout, saying how to wait longer", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(makeJournal({ recorder: [] }));

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, follow: true, timeout: "2" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(6);
    expect(result?.error).toContain("Stopped following recorder");
    expect(result?.error).toContain("--timeout");
    expect(callPublicApi).toHaveBeenCalledTimes(2);
  });

  it("refuses a --timeout that is not a positive number of seconds", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, follow: true, timeout: "soon" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
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
