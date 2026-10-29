import { describe, expect, it, mock } from "bun:test";
import {
  maxActivityWaitItems,
  maxAgentWaitSeconds,
} from "@qawolf/api-contracts/v1";

import { exitCodes } from "~/shell/exit.js";

import {
  activityAnswer,
  makeAuthCtx,
  makeTestDeps,
  session,
} from "./deps.testUtils.js";
import { handleAgentGet } from "./get.js";

const options = {
  follow: true,
  session: undefined,
  sessionArgument: undefined,
  sessions: ["session-one", "session-two", "session-one"],
  timeout: "120",
  workspaceId: undefined,
};

describe("multi-session waiting", () => {
  it("holds one wait across distinct children and reads only the child that settled", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");
    activityWaits
      .mockImplementationOnce(async (input) => activityAnswer(input, {}))
      .mockImplementationOnce(async (input) =>
        activityAnswer(input, { "session-two": "completed" }),
      );
    callPublicApi.mockResolvedValue(session({ status: "completed" }));

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    expect(activityWaits.mock.calls.map(([input]) => input)).toEqual([
      {
        cursors: {},
        sessionIds: ["session-one", "session-two"],
        waitSeconds: maxAgentWaitSeconds,
      },
      {
        cursors: {
          "session-one": "cursor-session-one",
          "session-two": "cursor-session-two",
        },
        sessionIds: ["session-one", "session-two"],
        waitSeconds: maxAgentWaitSeconds,
      },
    ]);
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { sessionId: "session-two", waitSeconds: 0 },
    ]);
  });

  it("gives the held wait longer to answer than the server holds it", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");
    activityWaits.mockImplementationOnce(async (input) =>
      activityAnswer(input, { "session-one": "completed" }),
    );
    callPublicApi.mockResolvedValue(session({ status: "completed" }));

    await handleAgentGet(ctx, options, makeTestDeps());

    const [, requestOptions] = activityWaits.mock.calls[0] ?? [];
    expect(requestOptions?.timeoutMs).toBeGreaterThan(
      maxAgentWaitSeconds * 1_000,
    );
  });

  it("keeps waiting on a child that is waiting with nothing to ask", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");
    activityWaits
      .mockImplementationOnce(async (input) =>
        activityAnswer(input, { "session-one": "waiting-for-you" }),
      )
      .mockImplementationOnce(async (input) =>
        activityAnswer(input, { "session-two": "completed" }),
      );
    callPublicApi
      .mockResolvedValueOnce(session({ status: "waiting-for-you" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    expect(activityWaits).toHaveBeenCalledTimes(2);
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { sessionId: "session-one", waitSeconds: 0 },
      { sessionId: "session-two", waitSeconds: 0 },
    ]);
  });

  it("shortens the hold to the time left and stops at the follow deadline", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");
    let clock = 0;
    activityWaits.mockImplementation(async (input) => {
      clock += input.waitSeconds * 1_000;
      return activityAnswer(input, {});
    });

    const result = await handleAgentGet(
      ctx,
      { ...options, timeout: "50" },
      makeTestDeps({ now: () => clock }),
    );

    expect(result?.exitCode).toBe(exitCodes.timeout);
    expect(result?.error).toContain("2 sessions");
    expect(
      activityWaits.mock.calls.map(([input]) => input.waitSeconds),
    ).toEqual([maxAgentWaitSeconds, 50 - maxAgentWaitSeconds]);
    expect(callPublicApi).not.toHaveBeenCalled();
    expect(clock).toBe(50_000);
  });

  it("reports a deadline that passes during a failed wait as a timeout", async () => {
    const { activityWaits, ctx } = makeAuthCtx("json");
    let clock = 0;
    activityWaits.mockImplementation(async (input) => {
      clock += input.waitSeconds * 1_000;
      return { error: "Request timed out", ok: false };
    });

    const result = await handleAgentGet(
      ctx,
      { ...options, timeout: "3" },
      makeTestDeps({ now: () => clock }),
    );

    expect(result?.exitCode).toBe(exitCodes.timeout);
  });

  it("refuses more sessions than one wait can hold before sending any request", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");

    const result = await handleAgentGet(
      ctx,
      {
        ...options,
        sessions: [...Array(maxActivityWaitItems + 1).keys()].map(
          (index) => `session-${index}`,
        ),
      },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(activityWaits).not.toHaveBeenCalled();
    expect(callPublicApi).not.toHaveBeenCalled();
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
