import { describe, expect, it, mock } from "bun:test";

import type { AgentSession } from "~/core/agent/session.js";
import { exitCodes } from "~/shell/exit.js";

import { followSession } from "./followSession.js";
import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";

const follow = {
  initial: undefined,
  repliesAtAnswer: undefined,
  sessionId: "sess_1",
  timeoutSeconds: 600,
  workspaceId: undefined,
};

describe("followSession, attaching to a session", () => {
  it("follows from a read already in hand instead of fetching it again", async () => {
    const { callPublicApi, ctx, transcripts } = makeAuthCtx();
    const initial: AgentSession = {
      replies: [{ askedAt: "2026-09-09T12:00:00.000Z", text: "Looking." }],
      sessionId: "sess_1",
      status: "working",
      url: "https://app.qawolf.com/sessions/sess_1",
    };
    callPublicApi.mockResolvedValueOnce(
      session({ replies: [{ text: "Looking." }], status: "completed" }),
    );

    await followSession(ctx, { ...follow, initial }, makeTestDeps());

    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(transcripts()).toHaveLength(1);
  });

  it("does not re-ask the question a just-sent message answered", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    const select = mock(async () => ({ ok: true, value: "staging" }) as const);
    ctx.ui.select = select;
    callPublicApi
      // The status still lags the send that answered this.
      .mockResolvedValueOnce(
        session({
          replies: [{ choices: ["staging"], text: "Which environment?" }],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, { ...follow, repliesAtAnswer: 1 }, makeTestDeps());

    expect(select).not.toHaveBeenCalled();
  });

  it("still prompts for a question that arrived after the message was sent", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    const select = mock(async () => ({ ok: true, value: "staging" }) as const);
    ctx.ui.select = select;
    callPublicApi
      .mockResolvedValueOnce(
        session({
          replies: [
            { text: "Which account?" },
            { choices: ["staging"], text: "Which environment?" },
          ],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(session({ status: "completed" }));

    // One reply was answered by the send; the second is new.
    await followSession(ctx, { ...follow, repliesAtAnswer: 1 }, makeTestDeps());

    expect(select).toHaveBeenCalledTimes(1);
  });

  it("sends every answer to the workspace the follow was given", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    ctx.ui.select = mock(async () => ({ ok: true, value: "staging" }) as const);
    callPublicApi
      .mockResolvedValueOnce(
        session({
          replies: [{ choices: ["staging"], text: "Which environment?" }],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(
      ctx,
      { ...follow, workspaceId: "ws_1" },
      makeTestDeps(),
    );

    expect(callPublicApi.mock.calls[1]?.[1]).toMatchObject({
      message: "staging",
      workspaceId: "ws_1",
    });
  });

  it("keeps the client's exit code for a refused request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "not signed in",
      exitCode: exitCodes.auth,
      ok: false,
    });

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.auth);
  });

  it("ends machine output with the session record, settled or blocked", async () => {
    const settled = makeAuthCtx("json");
    settled.callPublicApi.mockResolvedValue(session({ status: "completed" }));
    await followSession(settled.ctx, follow, makeTestDeps());
    expect(settled.jsonLines()[0]).toMatchObject({ status: "completed" });

    const blocked = makeAuthCtx("agent");
    blocked.callPublicApi.mockResolvedValue(
      session({
        replies: [{ text: "Which account?" }],
        status: "waiting-for-you",
      }),
    );
    await followSession(blocked.ctx, follow, makeTestDeps());
    expect(blocked.jsonLines()[0]).toMatchObject({
      sessionId: "sess_1",
      status: "waiting-for-you",
    });
  });
});
