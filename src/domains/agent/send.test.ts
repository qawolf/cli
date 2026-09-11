import { describe, expect, it, mock } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { handleAgentSend } from "./send.js";
import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";

const started = {
  ok: true,
  value: {
    sessionId: "sess_1",
    status: "working",
    url: "https://app.qawolf.com/sessions/sess_1",
  },
} as const;

const base = {
  environmentId: undefined,
  follow: false,
  message: "cover the checkout journey",
  session: undefined,
  timeout: undefined,
  workspaceId: undefined,
};

describe("handleAgentSend", () => {
  it("opens a session and answers with the id to follow it by", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    const result = await handleAgentSend(ctx, base, makeTestDeps());

    expect(result).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("sess_1");
    // The workspace a session opens in is not always the one the caller has
    // open in the app, so the message has to say where it went.
    expect(outputs()[0]?.humanMessage).toContain(
      "https://app.qawolf.com/sessions/sess_1",
    );
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      message: "cover the checkout journey",
    });
  });

  it("remembers the session, so a later follow needs no id typed back at it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(ctx, base, deps);

    expect(await deps.store.readLastSessionId()).toBe("sess_1");
  });

  it("opens a new session rather than continuing the last one", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps();
    await deps.store.rememberSession("sess_old");
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(ctx, base, deps);

    expect(callPublicApi.mock.calls[0]?.[1]).not.toHaveProperty("sessionId");
  });

  it("stays and follows the session it opened when asked to", async () => {
    const { callPublicApi, ctx, transcripts } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(
        session({ replies: [{ text: "Done." }], status: "completed" }),
      );

    const result = await handleAgentSend(
      ctx,
      { ...base, follow: true },
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
    expect(transcripts()).toHaveLength(1);
    expect(transcripts()[0]?.body).toBe("Done.");
  });

  it("passes the workspace through for a credential that is not bound to one", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(
      ctx,
      { ...base, workspaceId: "ws_1" },
      makeTestDeps(),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      workspaceId: "ws_1",
    });
  });

  it("reads the reply count before a message into a followed session, and prompts only for what arrives after", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    const select = mock(async () => ({ ok: true, value: "staging" }) as const);
    ctx.ui.select = select;
    const answered = { choices: ["a", "b"], text: "Which account?" };
    callPublicApi
      .mockResolvedValueOnce(
        session({ replies: [answered], status: "waiting-for-you" }),
      )
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(
        session({
          replies: [answered, { choices: ["staging"], text: "Which env?" }],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(session({ status: "completed" }));

    await handleAgentSend(
      ctx,
      { ...base, follow: true, message: "a", session: "sess_1" },
      makeTestDeps(),
    );

    expect(callPublicApi.mock.calls[0]?.[0]).toMatchObject({
      name: "agent.get",
    });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("keeps the client's exit code when the platform refuses the request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "payment required",
      exitCode: exitCodes.payment,
      ok: false,
    });

    const result = await handleAgentSend(ctx, base, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.payment);
  });

  it("refuses an empty message before any request goes out", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleAgentSend(
      ctx,
      { ...base, message: "   " },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a timeout that is not a positive whole number of seconds", async () => {
    const { ctx } = makeAuthCtx();

    const result = await handleAgentSend(
      ctx,
      { ...base, timeout: "soon" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
  });
});
