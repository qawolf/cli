import { describe, expect, it } from "bun:test";
import { maxAgentWaitSeconds } from "@qawolf/api-contracts/v1";

import { exitCodes } from "~/shell/exit.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

import {
  activityAnswer,
  makeAuthCtx,
  makeTestDeps,
  session,
} from "./deps.testUtils.js";
import { handleAgentGet } from "./get.js";

const manySessions = [...Array(50).keys()].map((index) => `session-${index}`);

const options = {
  follow: true,
  session: undefined,
  sessionArgument: undefined,
  sessions: manySessions,
  timeout: "120",
  workspaceId: undefined,
};

const unanswered = new Promise<PlatformResult<unknown>>(() => {});

describe("multi-session waits above the per-request cap", () => {
  it("splits the sessions across concurrent waits and wakes on the first to answer", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");
    activityWaits.mockImplementation((input) =>
      input.sessionIds.includes("session-45")
        ? Promise.resolve(activityAnswer(input, { "session-45": "completed" }))
        : unanswered,
    );
    callPublicApi.mockResolvedValue(session({ status: "completed" }));

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    expect(activityWaits.mock.calls.map(([input]) => input.sessionIds)).toEqual(
      [
        manySessions.slice(0, 20),
        manySessions.slice(20, 40),
        manySessions.slice(40, 50),
      ],
    );
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { sessionId: "session-45", waitSeconds: 0 },
    ]);
  });

  it("keeps the waits still holding and sends again only the one that answered", async () => {
    const { activityWaits, callPublicApi, ctx } = makeAuthCtx("json");
    let firstWaitAnswers = 0;
    activityWaits.mockImplementation((input) => {
      if (!input.sessionIds.includes("session-0")) return unanswered;
      firstWaitAnswers++;
      return Promise.resolve(
        activityAnswer(
          input,
          firstWaitAnswers === 1 ? {} : { "session-0": "completed" },
        ),
      );
    });
    callPublicApi.mockResolvedValue(session({ status: "completed" }));

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    const sent = activityWaits.mock.calls.map(([input]) => input);
    expect(sent.map((input) => input.sessionIds[0])).toEqual([
      "session-0",
      "session-20",
      "session-40",
      "session-0",
    ]);
    expect(sent[3]?.cursors).toEqual(
      Object.fromEntries(
        manySessions
          .slice(0, 20)
          .map((sessionId) => [sessionId, `cursor-${sessionId}`]),
      ),
    );
  });

  it("plans a fresh hold from the time left after a wait times out, instead of resending it", async () => {
    const { activityWaits, ctx } = makeAuthCtx("json");
    let clock = 0;
    activityWaits
      .mockImplementationOnce(async (_input, requestOptions) => {
        clock += requestOptions?.timeoutMs ?? 0;
        return { error: "timed out", ok: false, timedOut: true };
      })
      .mockImplementation(async (input) => {
        clock += input.waitSeconds * 1_000;
        return activityAnswer(input, {});
      });

    const result = await handleAgentGet(
      ctx,
      { ...options, sessions: ["session-one", "session-two"], timeout: "100" },
      makeTestDeps({ now: () => clock }),
    );

    expect(result?.exitCode).toBe(exitCodes.timeout);
    expect(
      activityWaits.mock.calls.map(([input]) => input.waitSeconds),
    ).toEqual([maxAgentWaitSeconds, 100 - maxAgentWaitSeconds - 15]);
    expect(activityWaits.mock.calls[0]?.[1]?.retryTimeouts).toBe(false);
    expect(clock).toBe(100_000);
  });
});
