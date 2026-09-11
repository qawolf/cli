import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { handleAgentGet } from "./get.js";
import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";

const base = {
  follow: false,
  session: undefined,
  sessionArgument: undefined,
  timeout: undefined,
  workspaceId: undefined,
};

describe("handleAgentGet", () => {
  it("prints the transcript and where the session stands", async () => {
    const { callPublicApi, ctx, outputs, transcripts } = makeAuthCtx();
    callPublicApi.mockResolvedValue(
      session({ replies: [{ text: "Wrote the flow." }], status: "working" }),
    );

    const result = await handleAgentGet(
      ctx,
      { ...base, session: "sess_1" },
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
    expect(transcripts()).toHaveLength(1);
    expect(transcripts()[0]?.body).toBe("Wrote the flow.");
    expect(transcripts()[0]?.headline).toContain("QA Wolf");
    // The session object is the result, so a machine gets it whole and a
    // person gets one line of where it stands.
    expect(outputs()[0]?.data).toMatchObject({ status: "working" });
    expect(outputs()[0]?.humanMessage).toContain("working");
    expect(outputs()[0]?.humanMessage).toContain(
      "https://app.qawolf.com/sessions/sess_1",
    );
  });

  it("lists a question's choices, since nothing will prompt for them", async () => {
    const { callPublicApi, ctx, transcripts } = makeAuthCtx("agent");
    callPublicApi.mockResolvedValue(
      session({
        replies: [{ choices: ["staging", "production"], text: "Which?" }],
        status: "waiting-for-you",
      }),
    );

    await handleAgentGet(ctx, { ...base, session: "sess_1" }, makeTestDeps());

    expect(transcripts()[0]?.body).toContain("- staging");
  });

  it("falls back to the environment, then to the session this directory started", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps({ env: { QAWOLF_SESSION_ID: "sess_env" } });
    callPublicApi.mockResolvedValue(session({ status: "working" }));

    await handleAgentGet(ctx, base, deps);

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({ sessionId: "sess_env" });
  });

  it("reads the session this directory last started when nothing else names one", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps();
    await deps.store.rememberSession("sess_stored");
    callPublicApi.mockResolvedValue(session({ status: "working" }));

    await handleAgentGet(ctx, base, deps);

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      sessionId: "sess_stored",
    });
  });

  it("takes the session as an argument, as `agent get <id>`", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(session({ status: "working" }));

    await handleAgentGet(
      ctx,
      { ...base, sessionArgument: "sess_arg" },
      makeTestDeps(),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({ sessionId: "sess_arg" });
  });

  it("refuses two different sessions rather than picking one", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleAgentGet(
      ctx,
      { ...base, session: "sess_flag", sessionArgument: "sess_arg" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain("sess_arg");
    expect(result?.error).toContain("sess_flag");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("accepts the same session named both ways", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(session({ status: "working" }));

    const result = await handleAgentGet(
      ctx,
      { ...base, session: "sess_1", sessionArgument: "sess_1" },
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
  });

  it("says what to do when nothing names a session", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleAgentGet(ctx, base, makeTestDeps());

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain("QAWOLF_SESSION_ID");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("follows the session instead of reading it once when asked to", async () => {
    const { callPublicApi, ctx, infos, successes } = makeAuthCtx();
    callPublicApi.mockResolvedValue(session({ status: "completed" }));

    await handleAgentGet(
      ctx,
      { ...base, follow: true, session: "sess_1" },
      makeTestDeps(),
    );

    // A follow that attaches to a session has not said where it is yet.
    expect(infos().join("\n")).toContain(
      "https://app.qawolf.com/sessions/sess_1",
    );
    expect(successes()[0]).toContain("finished the work");
  });
});
