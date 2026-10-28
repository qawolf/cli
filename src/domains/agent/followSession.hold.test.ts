import { describe, expect, it } from "bun:test";
import { maxAgentWaitSeconds } from "@qawolf/api-contracts/v1";

import { exitCodes } from "~/shell/exit.js";

import { followSession } from "./followSession.js";
import {
  heldRead,
  makeAuthCtx,
  makeTestDeps,
  session,
} from "./deps.testUtils.js";

const follow = {
  initial: undefined,
  repliesAtAnswer: undefined,
  sessionId: "sess_1",
  timeoutSeconds: 600,
  workspaceId: undefined,
};

describe("followSession held waits", () => {
  it("gives up following once the timeout passes, and says how to pick it back up", async () => {
    const { callPublicApi, ctx, heldReads } = makeAuthCtx();
    let clock = 0;
    callPublicApi.mockResolvedValue(session({ status: "working" }));
    heldReads.mockImplementation(async (input) => {
      clock += input.waitSeconds * 1_000;
      return heldRead(input, "timeout");
    });

    const result = await followSession(
      ctx,
      { ...follow, timeoutSeconds: 50 },
      makeTestDeps({ now: () => clock }),
    );

    expect(result?.exitCode).toBe(exitCodes.timeout);
    expect(result?.error).toContain(
      "qawolf agent get --follow --session sess_1",
    );
    expect(heldReads.mock.calls.map(([input]) => input.waitSeconds)).toEqual([
      maxAgentWaitSeconds,
      50 - maxAgentWaitSeconds,
    ]);
    expect(clock).toBe(50_000);
  });

  it("waits on the server from where the last read ended, for longer than the hold", async () => {
    const { callPublicApi, ctx, heldReads } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(heldReads.mock.calls[0]?.[0]).toEqual({
      cursor: "c1",
      sessionId: "sess_1",
      waitSeconds: maxAgentWaitSeconds,
    });
    expect(heldReads.mock.calls[0]?.[1]?.timeoutMs).toBeGreaterThan(
      maxAgentWaitSeconds * 1_000,
    );
  });

  it("reads the transcript again only once a held wait reports news", async () => {
    const { callPublicApi, ctx, heldReads } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));
    heldReads
      .mockImplementationOnce(async (input) => heldRead(input, "timeout"))
      .mockImplementationOnce(async (input) => heldRead(input, "timeout"))
      .mockImplementationOnce(async (input) => heldRead(input, "status"));

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result).toBeUndefined();
    expect(heldReads).toHaveBeenCalledTimes(3);
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { sessionId: "sess_1", waitSeconds: 0 },
      { sessionId: "sess_1", waitSeconds: 0 },
    ]);
  });

  it("reports a held wait that cannot reach the platform as a network failure", async () => {
    const { callPublicApi, ctx, heldReads } = makeAuthCtx();
    callPublicApi.mockResolvedValue(session({ status: "working" }));
    heldReads.mockResolvedValue({ error: "no route to host", ok: false });

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toBe("no route to host");
  });
});
