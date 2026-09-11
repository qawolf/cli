import { describe, expect, it, mock } from "bun:test";

import { followSession } from "./followSession.js";
import { makeAuthCtx, makeTestDeps, session } from "./deps.testUtils.js";

const follow = {
  initial: undefined,
  repliesAtAnswer: undefined,
  sessionId: "sess_1",
  timeoutSeconds: 600,
  workspaceId: undefined,
};

/** Records the order the spinner, the transcript and the prompt were touched in. */
function trackOrder(ctx: ReturnType<typeof makeAuthCtx>["ctx"]): string[] {
  const order: string[] = [];
  ctx.ui.wait = mock(() => {
    order.push("wait");
    return { stop: () => order.push("stop") };
  });
  ctx.ui.transcript = mock(() => {
    order.push("transcript");
  });
  ctx.ui.select = mock(async () => {
    order.push("select");
    return { ok: true, value: "staging" } as const;
  });
  ctx.ui.success = mock(() => {
    order.push("success");
  });
  return order;
}

describe("followSession, while nothing arrives", () => {
  it("spins in a terminal, and clears the spinner before the next reply prints", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human");
    const order = trackOrder(ctx);
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(
        session({ replies: [{ text: "Looking." }], status: "completed" }),
      );

    await followSession(ctx, follow, makeTestDeps());

    expect(order).toEqual(["wait", "stop", "transcript", "success"]);
  });

  it("clears the spinner before putting a question to the watcher", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human", {
      isInteractive: true,
    });
    const order = trackOrder(ctx);
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(
        session({
          replies: [{ choices: ["staging"], text: "Which environment?" }],
          status: "waiting-for-you",
        }),
      )
      .mockResolvedValueOnce({ ok: true, value: { sessionId: "sess_1" } })
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(order.slice(0, 4)).toEqual(["wait", "stop", "transcript", "select"]);
  });

  it("keeps one spinner running across polls that bring nothing", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human");
    const order = trackOrder(ctx);
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(order).toEqual(["wait", "stop", "success"]);
  });

  it("clears the spinner before the closing line, even with no reply to print", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human");
    const order = trackOrder(ctx);
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(order).toEqual(["wait", "stop", "success"]);
  });
});

describe("followSession, before its first wait", () => {
  it("says once, in a terminal, that Ctrl-C stops the follow and not the session", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx("human");
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(infos().filter((line) => line.includes("Ctrl-C"))).toHaveLength(1);
  });

  it("keeps the Ctrl-C hint out of machine output", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx("json");
    callPublicApi
      .mockResolvedValueOnce(session({ status: "working" }))
      .mockResolvedValueOnce(session({ status: "completed" }));

    await followSession(ctx, follow, makeTestDeps());

    expect(infos().join("\n")).not.toContain("Ctrl-C");
  });
});
