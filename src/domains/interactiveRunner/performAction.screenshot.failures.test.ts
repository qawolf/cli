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
describe("handleRunnerAct --screenshot after the action took effect", () => {
  it("reports an answer that came without the screen it asked for", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "step.jpg" },
      deps,
    );

    expect(result?.error).toContain("Performed click");
    expect(result?.error).toContain("do not repeat it");
    expect(result?.error).toContain("qawolf runner screenshot");
    expect(result?.exitCode).toBe(4);
    expect(deps.written).toEqual([]);
    expect(outputs()).toEqual([]);
  });

  it("reports a screen that did not arrive as a JPEG, writing nothing", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64: "not an image", outcome: "success" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "-" },
      deps,
    );

    expect(result?.error).toContain("Performed click");
    expect(result?.error).toContain("not a JPEG");
    expect(result?.error).toContain("do not repeat it");
    expect(result?.exitCode).toBe(4);
    expect(deps.stdoutWrites).toEqual([]);
  });

  it("reports a destination it could not write to, naming it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });
    const unwritable = makeTestDeps({
      writeScreenshot: async () => ({
        detail: "EACCES: permission denied",
        ok: false,
        reason: "unwritable",
      }),
    });

    const toFile = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "step.jpg" },
      unwritable,
    );
    const toStdout = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "-" },
      unwritable,
    );

    expect(toFile?.error).toContain('"step.jpg"');
    expect(toFile?.error).toContain("EACCES");
    expect(toFile?.error).toContain("do not repeat it");
    expect(toFile?.exitCode).toBe(2);
    expect(toStdout?.error).toContain("stdout");
    expect(toStdout?.error).not.toContain('"-"');
  });
});
