import { describe, expect, it, mock } from "bun:test";

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

describe("followSession", () => {
  it("prints each reply once as it arrives, and stops when the work is done", async () => {
    const { callPublicApi, ctx, successes, transcripts } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(
        session({ replies: [{ text: "Looking." }], status: "working" }),
      )
      .mockResolvedValueOnce(
        session({
          replies: [{ text: "Looking." }, { text: "Wrote the flow." }],
          status: "completed",
        }),
      );

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result).toBeUndefined();
    // One entry per reply, so nothing is replayed. How an entry is framed is
    // the renderer's business, tested there.
    expect(transcripts().map((entry) => entry.body)).toEqual([
      "Looking.",
      "Wrote the flow.",
    ]);
    expect(successes()[0]).toContain("finished the work");
  });

  it("fails the command when the session fails, and says where to look", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(session({ status: "failed" }));

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.testFailure);
    expect(result?.error).toContain("app.qawolf.com/sessions/sess_1");
  });

  it("says QA Wolf is working when a session has yet to say anything", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(infos()[0]).toContain("QA Wolf is working");
  });

  it("hands a blocking question back, cleanly, where nothing can be typed", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx();
    callPublicApi.mockResolvedValue(
      session({
        replies: [
          { choices: ["staging", "production"], text: "Which environment?" },
        ],
        status: "waiting-for-you",
      }),
    );

    const result = await followSession(ctx, follow, makeTestDeps());

    // Clean: a session that asked a question has handed the work back, not failed.
    expect(result).toBeUndefined();
    expect(infos().join("\n")).toContain("--session sess_1");
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });

  it("puts a question with choices to the person watching and sends the answer on", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    ctx.ui.select = mock(async () => ({ ok: true, value: "staging" }) as const);
    callPublicApi
      .mockResolvedValueOnce(
        session({
          replies: [
            { choices: ["staging", "production"], text: "Which environment?" },
          ],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(
        session({
          replies: [
            { choices: ["staging", "production"], text: "Which environment?" },
            { text: "Thanks, using staging." },
          ],
          status: "completed",
        }),
      );

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result).toBeUndefined();
    const sent = callPublicApi.mock.calls[1];
    expect(sent?.[0]).toMatchObject({ name: "agent.send" });
    expect(sent?.[1]).toEqual({ message: "staging", sessionId: "sess_1" });
  });

  it("asks for a typed answer when the question offers no choices", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    ctx.ui.text = mock(
      async () => ({ ok: true, value: "use acme.test" }) as const,
    );
    callPublicApi
      .mockResolvedValueOnce(
        session({
          replies: [{ text: "Which account?" }],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(ctx.ui.text).toHaveBeenCalled();
    expect(callPublicApi.mock.calls[1]?.[1]).toEqual({
      message: "use acme.test",
      sessionId: "sess_1",
    });
  });

  it("does not ask the same question twice while the status lags the answer", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    const select = mock(async () => ({ ok: true, value: "staging" }) as const);
    ctx.ui.select = select;
    const blocked = session({
      replies: [{ choices: ["staging"], text: "Which environment?" }],
      status: "waiting-for-you",
    });
    callPublicApi
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      // The platform has not picked the answer up yet: same status, same replies.
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(select).toHaveBeenCalledTimes(1);
  });

  it("leaves the session alone when the watcher declines to answer", async () => {
    const { callPublicApi, ctx, warnings } = makeAuthCtx("human", {
      isInteractive: true,
    });
    ctx.ui.select = mock(async () => ({ ok: false }) as const);
    callPublicApi.mockResolvedValue(
      session({
        replies: [{ choices: ["staging"], text: "Which environment?" }],
        status: "waiting-for-you",
      }),
    );

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result).toBeUndefined();
    expect(warnings()[0]).toContain("still waiting");
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });

  it("gives up following once the timeout passes, and says how to pick it back up", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(session({ status: "working" }));

    const result = await followSession(
      ctx,
      { ...follow, timeoutSeconds: 2 },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.timeout);
    expect(result?.error).toContain(
      "qawolf agent get --follow --session sess_1",
    );
  });

  it("reports a platform that cannot be reached as a network failure", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: false, error: "no route to host" });

    const result = await followSession(ctx, follow, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toBe("no route to host");
  });
});
