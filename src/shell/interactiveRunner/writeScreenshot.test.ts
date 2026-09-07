import { Writable } from "node:stream";
import { describe, expect, it } from "bun:test";

import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { type ScreenshotStdout, writeScreenshot } from "./writeScreenshot.js";

const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const imageJpegBase64 = Buffer.from(jpegBytes).toString("base64");

/**
 * Records what reached stdout, and lets a test close the pipe. A real
 * `Writable` rather than an object with a `write`, because a failed write on a
 * real stream also emits `error`, and a double that only calls back would pass
 * a writer that lets that event crash the process.
 */
function makeRecordingStdout(failWith?: Error): {
  stdout: ScreenshotStdout;
  chunks: Uint8Array[];
} {
  const chunks: Uint8Array[] = [];
  const stdout = new Writable({
    write(chunk: Uint8Array, _encoding, callback) {
      if (failWith) {
        callback(failWith);
        return;
      }
      chunks.push(Uint8Array.from(chunk));
      callback();
    },
  });
  return { chunks, stdout };
}

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
      stdout: makeRecordingStdout().stdout,
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
      stdout: makeRecordingStdout().stdout,
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
      stdout: makeRecordingStdout().stdout,
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
      const { chunks, stdout } = makeRecordingStdout();

      const result = await writeScreenshot({
        fs,
        imageJpegBase64: payload,
        path: "shot.jpg",
        stdout,
      });

      expect(result).toEqual({ ok: false, reason: "not-a-jpeg" });
      expect(writes).toEqual([]);
      expect(chunks).toEqual([]);
    });

    it(`refuses ${name} for stdout too, writing nothing`, async () => {
      const { fs, writes } = makeRecordingFs();
      const { chunks, stdout } = makeRecordingStdout();

      const result = await writeScreenshot({
        fs,
        imageJpegBase64: payload,
        path: "-",
        stdout,
      });

      expect(result).toEqual({ ok: false, reason: "not-a-jpeg" });
      expect(writes).toEqual([]);
      expect(chunks).toEqual([]);
    });
  }

  describe("to stdout", () => {
    // The same trap as the file: the bytes go out, not the base64 text.
    it("writes decoded image bytes to stdout and nothing to the filesystem", async () => {
      const { fs, writes } = makeRecordingFs();
      const { chunks, stdout } = makeRecordingStdout();

      const result = await writeScreenshot({
        fs,
        imageJpegBase64,
        path: "-",
        stdout,
      });

      expect(result).toEqual({ ok: true });
      expect(chunks).toEqual([jpegBytes]);
      expect(writes).toEqual([]);
      expect(await fs.pathExists("-")).toBe(false);
    });

    // A reader that went away is an unwritable destination, answered before the
    // command claims success rather than as an EPIPE after it. The stream also
    // emits `error` after the callback, so the test waits a tick for the event
    // that would otherwise be uncaught.
    it("reports a pipe that would not take the bytes, and survives the error event", async () => {
      const { fs } = makeRecordingFs();
      const { stdout } = makeRecordingStdout(new Error("EPIPE: broken pipe"));

      const result = await writeScreenshot({
        fs,
        imageJpegBase64,
        path: "-",
        stdout,
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(result).toEqual({
        detail: "EPIPE: broken pipe",
        ok: false,
        reason: "unwritable",
      });
    });

    it("leaves no error listener behind after a successful write", async () => {
      const { fs } = makeRecordingFs();
      const { stdout } = makeRecordingStdout();

      await writeScreenshot({ fs, imageJpegBase64, path: "-", stdout });

      expect((stdout as Writable).listenerCount("error")).toBe(0);
    });
  });
});
