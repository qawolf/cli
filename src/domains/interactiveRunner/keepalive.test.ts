import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerKeepalive } from "./keepalive.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { makeJournal } from "./journal.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

describe("handleRunnerKeepalive", () => {
  // There is no keepalive endpoint and this does not want one: every request the
  // pod serves moves the activity time the inactivity reaper reads, and a tail
  // read seeks from the end rather than scanning, so it is the cheapest of them.
  it("resets the clock with one bounded journal read", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockImplementation(makeJournal({ "run-status": [[]] }));

    const result = await handleRunnerKeepalive(
      ctx,
      { runner: "ci" },
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.readJournal,
      { id: "ci", stream: "run-status", tail: 1 },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toContain("is alive");
    expect(outputs()[0]?.data).toEqual({ id: "ci", outcome: "alive" });
  });

  it("targets the stored default when no flag names a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockImplementation(makeJournal({ "run-status": [[]] }));
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("from-store");

    await handleRunnerKeepalive(ctx, { runner: undefined }, deps);

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      id: "from-store",
    });
  });

  // A caller asking to keep a runner alive has one in mind; starting a fresh one
  // would answer a question nobody asked, and bill for it.
  it("never launches a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerKeepalive(
      ctx,
      { runner: undefined },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("reports a runner whose clock could not be reset because it is gone", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerKeepalive(
      ctx,
      { runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("could not be reached");
    expect(result?.exitCode).toBe(4);
  });
});
