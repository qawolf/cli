import { describe, expect, it } from "bun:test";

import { handleRunnerAct } from "./performAction.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const click = {
  flags: {
    button: "left",
    keys: undefined,
    path: undefined,
    scrollX: undefined,
    scrollY: undefined,
    text: undefined,
    url: undefined,
    x: "1",
    y: "2",
  },
  runner: "ci",
  type: "click",
};

async function actWith(value: unknown) {
  const { callPublicApi, ctx, outputs } = makeAuthCtx();
  callPublicApi.mockResolvedValue({ ok: true, value });
  const result = await handleRunnerAct(ctx, click, makeTestDeps());
  return { outputs, result };
}

describe("handleRunnerAct outcomes", () => {
  it("reports the action it performed", async () => {
    const { outputs, result } = await actWith({ outcome: "performed" });

    expect(result).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toBe("Performed click.");
    expect(outputs()[0]?.data).toMatchObject({ outcome: "performed" });
  });

  // Attempted and did not take effect: an answer, not a fault on our side.
  it("reports what stopped an action that reached the runner", async () => {
    const { result } = await actWith({
      errorMessage: "the page navigated away",
      outcome: "action-failed",
    });

    expect(result?.error).toContain("the page navigated away");
    expect(result?.exitCode).toBe(1);
  });

  // Not a wait: only a run starts the desktop, so a caller that retries this one
  // retries for ever.
  it("reads a screen that has never started as needing a run, not a retry", async () => {
    const { result } = await actWith({ outcome: "screen-needs-a-run" });

    expect(result?.error).toContain("qawolf runner run");
    expect(result?.exitCode).toBe(2);
  });

  // Transient, and worth trying again in a second or two.
  it("reads a screen that is not up yet as worth retrying", async () => {
    const { result } = await actWith({ outcome: "screen-not-ready" });

    expect(result?.error).toContain("Retry in a second or two");
    expect(result?.exitCode).toBe(4);
  });

  // Permanent, and the caller's to fix by launching a different image.
  it("reads a runner with no screen as never going to work", async () => {
    const { result } = await actWith({ outcome: "runner-has-no-screen" });

    expect(result?.error).toContain("Retrying will never help");
    expect(result?.error).toContain("playwright");
    expect(result?.exitCode).toBe(2);
  });

  // Alone among these verbs, this one may have taken effect before its answer was
  // lost, so the message must not read as an invitation to repeat the click.
  it("does not invite a bare repeat when the answer was lost", async () => {
    const { result } = await actWith({ outcome: "runner-unreachable" });

    expect(result?.error).toContain(
      "does not mean the action was not performed",
    );
    expect(result?.exitCode).toBe(4);
  });

  // The same hazard arrives at the transport as a timed-out request, and it must
  // carry the same warning rather than the generic failure alone.
  it("does not invite a bare repeat when the request timed out", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "request timed out after 15000ms",
      mayHaveArrived: true,
      ok: false,
    });

    const result = await handleRunnerAct(ctx, click, makeTestDeps());

    expect(result?.error).toContain("timed out");
    expect(result?.error).toContain(
      "does not mean the action was not performed",
    );
    expect(result?.exitCode).toBe(4);
  });
});
