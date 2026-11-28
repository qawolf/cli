import { afterEach, describe, expect, it, mock } from "bun:test";
import { z } from "zod";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { buildCommandSpecs, type CommandSpec } from "./commandSpecs.js";
import { standInAnnotationJustifications } from "./contract.fixtures.js";
import { handlePublicApiCommand } from "./handle.js";
import { ctxWith } from "./handle.testUtils.js";

afterEach(() => {
  mock.restore();
});

const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const outputFile = "/frame.jpeg";

function frameSpec(): CommandSpec {
  const contract = {
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
    annotationJustifications: standInAnnotationJustifications,
    name: "fake.frame",
    kind: "read" as const,
    description: "synthetic image-answer contract",
    input: z.object({ attemptId: z.string() }),
    output: z.object({ imageJpegBase64: z.string(), index: z.number() }),
  };
  const [spec] = buildCommandSpecs({ fake: { frame: contract } });
  if (!spec) throw new Error("fake.frame spec missing");
  return spec;
}

function setUp(imageJpegBase64: string) {
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { imageJpegBase64, index: 3 },
  });
  const ui = makeFakeUI();
  const memory = makeMemoryFs();
  const writes: { data: string | Uint8Array; path: string }[] = [];
  const fs = {
    ...memory,
    async writeFileExclusive(
      path: string,
      data: string | Uint8Array,
      options?: { mode?: number },
    ) {
      const written = await memory.writeFileExclusive(path, data, options);
      if (written) writes.push({ data, path });
      return written;
    },
  };
  const ctx = {
    ...ctxWith(ui, makeMockPlatformClient({ callPublicApi })),
    fs,
  };
  return { callPublicApi, ctx, ui, writes };
}

describe("handlePublicApiCommand --output-file", () => {
  it("writes the image's JPEG bytes and prints the rest of the answer", async () => {
    const { ctx, ui, writes } = setUp(
      Buffer.from(jpegBytes).toString("base64"),
    );

    const result = await handlePublicApiCommand(ctx, frameSpec(), {
      attemptId: "attempt-1",
      outputFile,
    });

    expect(result).toBeUndefined();
    expect(writes).toEqual([
      { data: Buffer.from(jpegBytes), path: outputFile },
    ]);
    expect(ui.output).toHaveBeenCalledWith(
      { index: 3, outputFile },
      `index: 3\noutputFile: ${outputFile}`,
    );
  });

  it("refuses an existing file before calling the API", async () => {
    const { callPublicApi, ctx, writes } = setUp(
      Buffer.from(jpegBytes).toString("base64"),
    );
    await ctx.fs.writeFile(outputFile, "kept");

    const result = await handlePublicApiCommand(ctx, frameSpec(), {
      attemptId: "attempt-1",
      outputFile,
    });

    expect(result).toEqual({
      error: `Refusing to overwrite existing file: ${outputFile}`,
      exitCode: exitCodes.invalidArgs,
    });
    expect(callPublicApi).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    expect(await ctx.fs.readFile(outputFile)).toBe("kept");
  });

  it("writes nothing when the image is not a JPEG", async () => {
    const { ctx, ui, writes } = setUp(
      Buffer.from("not an image").toString("base64"),
    );

    const result = await handlePublicApiCommand(ctx, frameSpec(), {
      attemptId: "attempt-1",
      outputFile,
    });

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(writes).toEqual([]);
    expect(ui.output).not.toHaveBeenCalled();
  });

  it("prints the whole answer when no file is asked for", async () => {
    const imageJpegBase64 = Buffer.from(jpegBytes).toString("base64");
    const { ctx, ui, writes } = setUp(imageJpegBase64);

    await handlePublicApiCommand(ctx, frameSpec(), { attemptId: "attempt-1" });

    expect(writes).toEqual([]);
    expect(ui.output).toHaveBeenCalledWith(
      { imageJpegBase64, index: 3 },
      `imageJpegBase64: ${imageJpegBase64}\nindex: 3`,
    );
  });
});
