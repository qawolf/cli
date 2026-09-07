import { dirname } from "node:path";

import { errorMessage } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";

/**
 * JPEG's start-of-image marker. Checked because `Buffer.from(s, "base64")`
 * decodes leniently: it skips characters that are not base64 rather than
 * refusing, so an empty answer becomes an empty file and a data-URI prefix
 * becomes an image with rubbish in front of it. Both would otherwise be
 * reported as a screenshot written.
 */
const jpegStartOfImage = [0xff, 0xd8, 0xff];

/**
 * The `--out` value that sends the image to stdout instead of a file, the same
 * `-` that reads stdin for `act` and `exec`. A caller that wants the bytes in a
 * process reads them off the pipe rather than reserving a path, running the
 * command, reading the file back and deleting it.
 */
export const stdoutPath = "-";

/** The one stdout method the writer needs, so a test can stand in for it. */
export type ScreenshotStdout = {
  write(chunk: Uint8Array, callback: (error?: Error | null) => void): unknown;
};

export type ScreenshotWrite =
  | { ok: true }
  | { ok: false; reason: "not-a-jpeg" }
  | { ok: false; detail: string; reason: "unwritable" };

/**
 * Writes a screenshot the API answered with to a file, or to stdout.
 *
 * The decode is the whole job. The contract carries the image as base64 because
 * every answer on the API is JSON, so a caller that writes what it received
 * straight to a file ends up with a text file full of base64 rather than an
 * image, and only discovers it when something downstream refuses to open it.
 * Decoding lives next to the write so the two cannot be separated, and the bytes
 * are checked here because this is the last place that can notice.
 *
 * The parent directory is created because `--out` is how a caller files its
 * screenshots, and a run of them into `screens/` should not need a mkdir first.
 *
 * Stdout is awaited rather than fire-and-forget: on a pipe the write is
 * asynchronous on some platforms, and a closed reader has to be answered as an
 * unwritable destination rather than lost in an EPIPE after the command reported
 * success.
 */
export async function writeScreenshot(options: {
  fs: Fs;
  imageJpegBase64: string;
  path: string;
  stdout?: ScreenshotStdout;
}): Promise<ScreenshotWrite> {
  const bytes = Buffer.from(options.imageJpegBase64, "base64");
  if (jpegStartOfImage.some((byte, index) => bytes[index] !== byte)) {
    return { ok: false, reason: "not-a-jpeg" };
  }
  try {
    if (options.path === stdoutPath) {
      await writeToStdout(options.stdout ?? process.stdout, bytes);
    } else {
      await options.fs.mkdir(dirname(options.path), { recursive: true });
      await options.fs.writeFile(options.path, bytes);
    }
  } catch (error) {
    return { detail: errorMessage(error), ok: false, reason: "unwritable" };
  }
  return { ok: true };
}

function writeToStdout(
  stdout: ScreenshotStdout,
  bytes: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    stdout.write(bytes, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
