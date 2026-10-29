import { describe, expect, it, mock } from "bun:test";

import { handleRunnerEvents } from "./events.js";
import { type JournalPoll, makeJournal } from "./journal.testUtils.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const baseOptions = {
  envelope: false,
  follow: true,
  run: undefined,
  runner: "ci",
  since: undefined,
  stream: "recorder",
  tail: undefined,
  timeout: undefined,
};

describe("handleRunnerEvents --follow pacing", () => {
  it("reads less often while nothing arrives, and every second again once entries do", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(
      makeJournal({ recorder: [[], [], [], [{ code: "a" }], []] }),
    );
    const sleep = mock(async (_milliseconds: number) => {});

    const result = await handleRunnerEvents(
      ctx,
      { ...baseOptions, timeout: "13" },
      makeTestDeps({ sleep }),
    );

    expect(result?.exitCode).toBe(6);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      2_000, 3_000, 4_000, 1_000, 2_000, 1_000,
    ]);
    expect(callPublicApi).toHaveBeenCalledTimes(7);
  });

  it("keeps following an unreachable runner for the grace window whatever the read spacing", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const outage: JournalPoll[] = Array.from(
      { length: 30 },
      () => "unreachable",
    );
    callPublicApi.mockImplementation(makeJournal({ recorder: outage }));
    const sleep = mock(async (_milliseconds: number) => {});

    const result = await handleRunnerEvents(
      ctx,
      baseOptions,
      makeTestDeps({ sleep }),
    );

    expect(result?.exitCode).toBe(4);
    const waitedMs = sleep.mock.calls.reduce(
      (total, [milliseconds]) => total + milliseconds,
      0,
    );
    expect(waitedMs).toBeGreaterThanOrEqual(60_000);
    expect(waitedMs).toBeLessThan(65_000);
  });
});
