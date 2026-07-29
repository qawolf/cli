import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerScreenshot } from "./takeScreenshot.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

// Real JPEG magic bytes, so a test can tell a decoded image from its base64.
const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const imageJpegBase64 = Buffer.from(jpegBytes).toString("base64");

describe("handleRunnerScreenshot", () => {
  // The trap the contract warns about: a caller who writes the string ends up
  // with base64 text in a file named like an image.
  it("writes decoded image bytes rather than the base64 string", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "captured" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: "ci" },
      deps,
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.takeScreenshot,
      { id: "ci" },
    );
    expect(deps.written).toEqual([{ bytes: jpegBytes, path: "shot.jpg" }]);
  });

  it("says where it wrote the image", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "captured" },
    });

    await handleRunnerScreenshot(
      ctx,
      { out: "screens/step-3.jpg", runner: "ci" },
      makeTestDeps(),
    );

    expect(outputs()[0]?.humanMessage).toContain("screens/step-3.jpg");
    expect(outputs()[0]?.data).toEqual({
      outcome: "captured",
      path: "screens/step-3.jpg",
    });
  });

  // Worth waiting on: the desktop starts with the runner's first run.
  it("reads a screen that is not up yet as worth retrying", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "screen-not-ready" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: "ci" },
      deps,
    );

    expect(result?.error).toContain("Retry in a second or two");
    expect(result?.exitCode).toBe(4);
    expect(deps.written).toEqual([]);
  });

  // Never worth waiting on: this runner has no screen and never will.
  it("reads a runner with no screen differently, and as permanent", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "runner-has-no-screen" },
    });

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("Retrying will never help");
    expect(result?.exitCode).toBe(2);
  });

  it("reports an unreachable runner, writing nothing", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "runner-unreachable" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: "ci" },
      deps,
    );

    expect(result?.exitCode).toBe(4);
    expect(deps.written).toEqual([]);
  });
});
