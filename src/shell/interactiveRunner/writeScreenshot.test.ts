import { describe, expect, it } from "bun:test";

import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { writeScreenshot } from "./writeScreenshot.js";

const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const imageJpegBase64 = Buffer.from(jpegBytes).toString("base64");

/** Records what reached the filesystem, which is the only thing worth asserting. */
function makeRecordingFs(): {
  fs: Fs;
  writes: { data: string | Uint8Array; path: string }[];
} {
  const memory = makeMemoryFs();
  const writes: { data: string | Uint8Array; path: string }[] = [];
  return {
    fs: {
      ...memory,
      async writeFile(path, data, options) {
        await memory.writeFile(path, data, options);
        writes.push({ data, path });
      },
    },
    writes,
  };
}

describe("writeScreenshot", () => {
  // The trap the contract warns about: a caller that writes the string it was
  // handed ends up with base64 text in a file named like an image.
  it("writes decoded image bytes rather than the base64 string", async () => {
    const { fs, writes } = makeRecordingFs();

    const result = await writeScreenshot({
      fs,
      imageJpegBase64,
      path: "shot.jpg",
    });

    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([{ data: jpegBytes, path: "shot.jpg" }]);
  });

  // --out is how a caller files its screenshots, and the command's own help
  // suggests a subdirectory.
  it("creates the directory the image is filed under", async () => {
    const { fs, writes } = makeRecordingFs();

    const result = await writeScreenshot({
      fs,
      imageJpegBase64,
      path: "screens/step-3.jpg",
    });

    expect(result).toEqual({ ok: true });
    expect(writes[0]?.path).toBe("screens/step-3.jpg");
  });

  // A read-only directory, a path that names one, a full disk: all arrive here
  // as a rejected write, and none of them should reach the caller as a stack.
  it("reports a path it could not write to, naming what went wrong", async () => {
    const { fs } = makeRecordingFs();
    const refusing: Fs = {
      ...fs,
      writeFile: () =>
        Promise.reject(
          Object.assign(
            new Error("EACCES: permission denied, open 'shot.jpg'"),
            {
              code: "EACCES",
            },
          ),
        ),
    };

    const result = await writeScreenshot({
      fs: refusing,
      imageJpegBase64,
      path: "shot.jpg",
    });

    expect(result).toEqual({
      detail: "EACCES: permission denied, open 'shot.jpg'",
      ok: false,
      reason: "unwritable",
    });
  });

  // Buffer.from(s, "base64") skips characters that are not base64 rather than
  // refusing, so each of these would otherwise be written and called a success.
  const notJpeg = {
    "a data-URI prefix": `data:image/jpeg;base64,${imageJpegBase64}`,
    "an empty answer": "",
    "text that is not base64": "not an image at all",
    whitespace: "   ",
  };
  for (const [name, payload] of Object.entries(notJpeg)) {
    it(`refuses ${name}, writing nothing`, async () => {
      const { fs, writes } = makeRecordingFs();

      const result = await writeScreenshot({
        fs,
        imageJpegBase64: payload,
        path: "shot.jpg",
      });

      expect(result).toEqual({ ok: false, reason: "not-a-jpeg" });
      expect(writes).toEqual([]);
    });
  }
});
