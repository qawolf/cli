import { describe, expect, it, mock } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { followSession } from "./followSession.js";
import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";

const follow = {
  initial: undefined,
  repliesAtAnswer: undefined,
  sessionId: "sess_1",
  timeoutSeconds: 10,
  workspaceId: undefined,
};

describe("followSession timeout", () => {
  it("counts the time a request takes, not only the sleeps between them", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    let clock = 0;
    const deps = makeTestDeps({
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    // Every read takes ten seconds; the sleep between reads is five.
    callPublicApi.mockImplementation(async () => {
      clock += 10_000;
      return session({ status: "working" });
    });

    const result = await followSession(ctx, follow, deps);

    expect(result?.exitCode).toBe(exitCodes.timeout);
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });

  it("does not count the time the watcher spends at the prompt", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    let clock = 0;
    const deps = makeTestDeps({
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    ctx.ui.select = mock(async () => {
      clock += 600_000;
      return { ok: true, value: "staging" } as const;
    });
    callPublicApi
      .mockResolvedValueOnce(
        session({
          replies: [{ choices: ["staging"], text: "Which environment?" }],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(session({ status: "completed" }));

    const result = await followSession(ctx, follow, deps);

    expect(result).toBeUndefined();
  });
});
