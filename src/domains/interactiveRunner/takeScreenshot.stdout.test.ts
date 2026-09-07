import { describe, expect, it } from "bun:test";

import { handleRunnerScreenshot } from "./takeScreenshot.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const imageJpegBase64 = Buffer.from(jpegBytes).toString("base64");

describe("handleRunnerScreenshot --out -", () => {
  // The session reads the bytes off the pipe instead of reserving a
  // file, handing it to the sandboxed user, reading it back and deleting it.
  it("writes the decoded image bytes to stdout and no file", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "-", runner: "ci" },
      deps,
    );

    expect(result).toBeUndefined();
    expect(deps.stdoutWrites).toEqual([jpegBytes]);
    expect(deps.written).toEqual([]);
  });

  // Stdout is the image, so nothing else may land there: in json mode the
  // answer line would otherwise follow the JPEG bytes into the reader's file.
  // These two are the modes a piped stdout lands in; a terminal is human mode
  // and has no reader to protect.
  for (const mode of ["json", "agent"] as const) {
    it(`keeps the confirmation off stdout in ${mode} mode`, async () => {
      const { callPublicApi, ctx, outputs, streamed, successes } =
        makeAuthCtx(mode);
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { imageJpegBase64, outcome: "success" },
      });

      await handleRunnerScreenshot(
        ctx,
        { out: "-", runner: "ci" },
        makeTestDeps(),
      );

      expect(outputs()).toEqual([]);
      expect(streamed()).toEqual([]);
      expect(successes()).toHaveLength(1);
      expect(successes()[0]).toContain("stdout");
      expect(successes()[0]).toContain("stderr");
    });
  }

  it("reports a pipe that closed, naming stdout rather than a file", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64, outcome: "success" },
    });

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "-", runner: "ci" },
      makeTestDeps({
        writeScreenshot: async () => ({
          detail: "EPIPE: broken pipe",
          ok: false,
          reason: "unwritable",
        }),
      }),
    );

    expect(result?.error).toContain("stdout");
    expect(result?.error).toContain("EPIPE");
    expect(result?.error).not.toContain('to "-"');
    expect(result?.exitCode).toBe(2);
  });

  it("writes nothing to stdout when the answer was not an image", async () => {
    const { callPublicApi, ctx, successes } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { imageJpegBase64: "", outcome: "success" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "-", runner: "ci" },
      deps,
    );

    expect(result?.error).toContain("did not arrive as a JPEG");
    expect(deps.stdoutWrites).toEqual([]);
    expect(successes()).toEqual([]);
  });
});
