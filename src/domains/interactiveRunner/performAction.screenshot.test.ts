import { describe, expect, it } from "bun:test";

import { handleRunnerAct } from "./performAction.js";
import { performActionContract } from "./performActionContract.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

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
const clickAction = { button: "left", type: "click", x: 1, y: 2 };

describe("handleRunnerAct --screenshot", () => {
  it("asks the runner for the screen with the answer", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });

    await handleRunnerAct(
      ctx,
      { ...click, screenshot: "step.jpg" },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      performActionContract,
      { action: clickAction, id: "ci", screenshot: true },
      runnerCallOptions,
    );
  });

  // The same trap as `runner screenshot`: the file gets the image, not the text.
  it("writes the decoded screen to the file and says it did both", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: "screens/step-4.jpg" },
      deps,
    );

    expect(result).toBeUndefined();
    expect(deps.written).toEqual([
      { bytes: jpegBytes, path: "screens/step-4.jpg" },
    ]);
    expect(outputs()[0]?.humanMessage).toContain("Performed click");
    expect(outputs()[0]?.humanMessage).toContain("screens/step-4.jpg");
    expect(outputs()[0]?.data).toEqual({
      action: clickAction,
      outcome: "success",
      screenshotPath: "screens/step-4.jpg",
    });
  });

  // A forwarded tool call in, the frame out on the pipe.
  it("takes the action from stdin and writes the screen to stdout", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });
    const deps = makeTestDeps({
      readStdin: async () => JSON.stringify(clickAction),
    });

    const result = await handleRunnerAct(
      ctx,
      {
        ...click,
        flags: {
          ...click.flags,
          button: undefined,
          x: undefined,
          y: undefined,
        },
        screenshot: "-",
        type: "-",
      },
      deps,
    );

    expect(result).toBeUndefined();
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      action: clickAction,
      id: "ci",
      screenshot: true,
    });
    expect(deps.stdoutWrites).toEqual([jpegBytes]);
    expect(deps.written).toEqual([]);
  });

  // Stdout is the image, so the answer line may not follow it there.
  for (const mode of ["json", "agent"] as const) {
    it(`keeps the confirmation off stdout in ${mode} mode`, async () => {
      const { callPublicApi, ctx, outputs, streamed, successes } =
        makeAuthCtx(mode);
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { imageJpegBase64, outcome: "success" },
      });

      await handleRunnerAct(ctx, { ...click, screenshot: "-" }, makeTestDeps());

      expect(outputs()).toEqual([]);
      expect(streamed()).toEqual([]);
      expect(successes()).toHaveLength(1);
      expect(successes()[0]).toContain("Performed click");
      expect(successes()[0]).toContain("stderr");
    });
  }

  // Human mode means a terminal on stdout. Refused before a runner is resolved,
  // so nothing is launched and billed, and before the action, so the caller is
  // not left with a click that happened and a screen it cannot get.
  it("refuses a terminal on stdout before launching or acting", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("human");
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, runner: undefined, screenshot: "-" },
      deps,
    );

    expect(result?.error).toContain("terminal");
    expect(result?.error).toContain("--screenshot a file path");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
    expect(deps.stdoutWrites).toEqual([]);
  });

  // An image the flag did not ask for is not written anywhere.
  it("ignores an image that arrives without the flag", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerAct(
      ctx,
      { ...click, screenshot: undefined },
      deps,
    );

    expect(result).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toBe("Performed click.");
    expect(deps.written).toEqual([]);
    expect(deps.stdoutWrites).toEqual([]);
  });

  it("sends no screenshot option and writes nothing without the flag", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success" },
    });
    const deps = makeTestDeps();

    await handleRunnerAct(ctx, { ...click, screenshot: undefined }, deps);

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      action: clickAction,
      id: "ci",
    });
    expect(deps.written).toEqual([]);
    expect(deps.stdoutWrites).toEqual([]);
  });
});
