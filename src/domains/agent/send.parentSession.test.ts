import { describe, expect, it } from "bun:test";

import { handleAgentSend } from "./send.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

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
  filePaths: undefined,
  follow: false,
  message: "cover the checkout journey",
  session: undefined,
  timeout: undefined,
  workspaceId: undefined,
};

const podEnvironment = { QAWOLF_CHAT_SESSION_ID: "sess_parent" };

describe("handleAgentSend, naming the session that starts it", () => {
  it("names the chat session it runs in as the parent of the session it opens", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(ctx, base, makeTestDeps({ env: podEnvironment }));

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      message: "cover the checkout journey",
      parentSessionId: "sess_parent",
    });
  });

  it("names no parent when continuing a session, since that does not change what started it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(
      ctx,
      { ...base, session: "sess_1" },
      makeTestDeps({ env: podEnvironment }),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      message: "cover the checkout journey",
      sessionId: "sess_1",
    });
  });

  it("names no parent outside QA Wolf, where the variable is unset", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(ctx, base, makeTestDeps());

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      message: "cover the checkout journey",
    });
  });

  it("names no parent when the variable is blank", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(
      ctx,
      base,
      makeTestDeps({ env: { QAWOLF_CHAT_SESSION_ID: "  " } }),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      message: "cover the checkout journey",
    });
  });

  it("passes on why QA Wolf refused the parent, so the agent knows to do the work itself", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const refusal =
      "That session is itself a sub-session, and a sub-session cannot start sub-sessions of its own. Name the session that started it instead.";
    callPublicApi.mockResolvedValue({
      error: "QA Wolf API agent.send request failed (HTTP 400).",
      errorBody: refusal,
      ok: false,
    });

    const result = await handleAgentSend(
      ctx,
      base,
      makeTestDeps({ env: podEnvironment }),
    );

    expect(result?.errorBody).toBe(refusal);
  });
});
