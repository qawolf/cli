import { describe, expect, it } from "bun:test";

import { handleRunnerAct } from "./performAction.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const imageJpegBase64 = Buffer.from(jpegBytes).toString("base64");

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

// Every failure here follows a performed action, so none may read as an
// invitation to send it again: the caller's next move is a plain screenshot.
// All exit 4, the code the runner guide reads as "screenshot before repeating";
// a 2 from act is an argument to fix and re-send, which would be a double click.
// The merged contract puts `imageJpegBase64` on `action-failed` as well, so a
// click that missed still answers with the screen that shows why.
describe("handleRunnerAct --screenshot when the action was refused", () => {
  // The contract puts a screen on action-failed too, and seeing why a click
  // missed is the reason the caller asked for one. The refusal stays the news
  // and keeps exit 1; where the screen went is a sentence on the end.
  it("writes the screen a refused action came back with", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "the click hit nothing",
        failureReason: "action-failed",
        imageJpegBase64,
        outcome: "failure",
      },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "missed.jpg" },
      deps,
    );

    expect(result?.error).toContain("the click hit nothing");
    expect(result?.error).toContain("missed.jpg");
    expect(result?.error).toContain("rather than sending the action again");
    expect(result?.exitCode).toBe(1);
    expect(deps.written).toEqual([{ bytes: jpegBytes, path: "missed.jpg" }]);
  });

  it("sends a refused action's screen to stdout too", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "the click hit nothing",
        failureReason: "action-failed",
        imageJpegBase64,
        outcome: "failure",
      },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "-" },
      deps,
    );

    expect(result?.error).toContain("stdout");
    expect(result?.exitCode).toBe(1);
    expect(deps.stdoutWrites).toEqual([jpegBytes]);
  });

  it("says nothing was written when a refused action carried no screen", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "the click hit nothing",
        failureReason: "action-failed",
        outcome: "failure",
      },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "missed.jpg" },
      deps,
    );

    expect(result?.error).toContain("the click hit nothing");
    expect(result?.error).toContain("answered without a screen");
    expect(result?.exitCode).toBe(1);
    expect(deps.written).toEqual([]);
  });

  // A refusal that never reached the screen has none to carry, and must not
  // grow a sentence about one.
  it("leaves a refusal that never reached the screen alone", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "screen-needs-a-run", outcome: "failure" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "missed.jpg" },
      deps,
    );

    expect(result?.error).toContain("qawolf runner run");
    expect(result?.error).not.toContain("screen was written");
    expect(result?.exitCode).toBe(2);
    expect(deps.written).toEqual([]);
  });

  it("still warns that a timed-out request may have acted", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      error: "request timed out after 15000ms",
      mayHaveArrived: true,
      ok: false,
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "-" },
      deps,
    );

    expect(result?.error).toContain(
      "does not mean the action was not performed",
    );
    expect(result?.exitCode).toBe(4);
    expect(deps.stdoutWrites).toEqual([]);
  });

  it("still warns that a lost answer may have acted", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "step.jpg" },
      makeTestDeps(),
    );

    expect(result?.error).toContain(
      "does not mean the action was not performed",
    );
    expect(result?.exitCode).toBe(4);
  });
});
