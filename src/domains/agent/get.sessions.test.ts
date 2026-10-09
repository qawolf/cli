import { describe, expect, it } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { exitCodes } from "~/shell/exit.js";

import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";
import { handleAgentGet } from "./get.js";

const options = {
  follow: true,
  session: undefined,
  sessionArgument: undefined,
  sessions: ["session-working", "session-ready"],
  timeout: "120",
  workspaceId: undefined,
};

describe("agent get --sessions", () => {
  it("returns a completed child while the first child still works", async () => {
    const { callPublicApi, ctx, jsonLines } = makeAuthCtx("json");
    callPublicApi.mockImplementation(async (_contract, input) => {
      const { sessionId } = publicContractsV1.agent.get.input.parse(input);
      return {
        ok: true,
        value: {
          ...publicContractsV1.agent.get.output.parse(
            session({
              status: sessionId === "session-ready" ? "completed" : "working",
            }).value,
          ),
          sessionId,
        },
      };
    });

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    expect(jsonLines()).toEqual([
      expect.objectContaining({
        sessionId: "session-ready",
        status: "completed",
      }),
    ]);
    expect(callPublicApi.mock.calls.map(([, input]) => input)).toEqual([
      { sessionId: "session-working", waitSeconds: 0 },
      { sessionId: "session-ready", waitSeconds: 0 },
    ]);
  });

  it.each(["failed", "cancelled"] as const)(
    "returns the session and a failure exit code when a child is %s",
    async (status) => {
      const { callPublicApi, ctx, jsonLines } = makeAuthCtx("json");
      callPublicApi.mockResolvedValue(session({ status }));

      const result = await handleAgentGet(ctx, options, makeTestDeps());

      expect(result?.exitCode).toBe(exitCodes.testFailure);
      expect(jsonLines()).toEqual([expect.objectContaining({ status })]);
      expect(callPublicApi).toHaveBeenCalledTimes(1);
    },
  );

  it("returns a question without sending an answer, even at a human terminal", async () => {
    const { callPublicApi, ctx, transcripts } = makeAuthCtx("human", {
      isInteractive: true,
    });
    callPublicApi.mockResolvedValue(
      session({
        replies: [{ text: "Which environment?" }],
        status: "waiting-for-you",
      }),
    );

    const result = await handleAgentGet(ctx, options, makeTestDeps());

    expect(result).toBeUndefined();
    expect(transcripts()).toHaveLength(1);
    expect(transcripts()[0]?.body).toBe("Which environment?");
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(ctx.ui.text).not.toHaveBeenCalled();
  });

  it("refuses combined single-session and multi-session arguments before reading", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleAgentGet(
      ctx,
      { ...options, session: "session-other" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("requires --follow when --sessions is used", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleAgentGet(
      ctx,
      { ...options, follow: false },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain("--follow");
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
