import { describe, expect, it, mock } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";
import { handleAgentGet } from "./get.js";

const options = {
  follow: true,
  session: undefined,
  sessionArgument: undefined,
  sessions: ["session-one", "session-two", "session-one"],
  timeout: "6",
  workspaceId: undefined,
};

describe("multi-session polling", () => {
  it("polls distinct children with at most one request in flight", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    let active = 0;
    let maximumActive = 0;
    let reads = 0;
    callPublicApi.mockImplementation(async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active--;
      reads++;
      return session({ status: reads === 4 ? "completed" : "working" });
    });

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    expect(maximumActive).toBe(1);
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { sessionId: "session-one", waitSeconds: 0 },
      { sessionId: "session-two", waitSeconds: 0 },
      { sessionId: "session-one", waitSeconds: 0 },
      { sessionId: "session-two", waitSeconds: 0 },
    ]);
  });

  it("bounds request and sleep time by the whole follow deadline", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    let clock = 0;
    const sleep = mock(async (milliseconds: number) => {
      clock += milliseconds;
    });
    callPublicApi.mockImplementation(async () => {
      clock += 1000;
      return session({ status: "working" });
    });

    const result = await handleAgentGet(
      ctx,
      { ...options, timeout: "3" },
      makeTestDeps({ now: () => clock, sleep }),
    );

    expect(result?.exitCode).toBe(exitCodes.timeout);
    expect(result?.error).toContain("2 sessions");
    expect(
      callPublicApi.mock.calls.map(([, , requestOptions]) => requestOptions),
    ).toEqual([{ timeoutMs: 3000 }, { timeoutMs: 2000 }]);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(clock).toBe(3000);
  });

  it("surfaces a refused child read and preserves its authentication exit code", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      error: "Authentication refused",
      exitCode: exitCodes.auth,
      ok: false,
    });

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.auth);
    expect(result?.error).toBe("Authentication refused");
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });

  it("stops the wait indicator and removes its signal handler when reading fails", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const stop = mock(() => undefined);
    const detach = mock(() => undefined);
    const register = mock(() => detach);
    callPublicApi.mockResolvedValue({ error: "No route to host", ok: false });

    const result = await handleAgentGet(
      {
        ...ctx,
        signals: { ...ctx.signals, register },
        ui: { ...ctx.ui, wait: () => ({ stop }) },
      },
      options,
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it("refuses an empty list before sending any request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");

    const result = await handleAgentGet(
      ctx,
      { ...options, sessions: [] },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain("at least one session");
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
