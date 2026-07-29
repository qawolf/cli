import type { Fs } from "~/shell/fs.js";

/**
 * Writes a screenshot the API answered with to a file.
 *
 * The decode is the whole job. The contract carries the image as base64 because
 * every answer on the API is JSON, so a caller that writes what it received
 * straight to a file ends up with a text file full of base64 rather than an
 * image, and only discovers it when something downstream refuses to open it.
 * Decoding lives next to the write so the two cannot be separated.
 */
export async function writeScreenshot(options: {
  fs: Fs;
  imageJpegBase64: string;
  path: string;
}): Promise<void> {
  await options.fs.writeFile(
    options.path,
    Buffer.from(options.imageJpegBase64, "base64"),
  );
}
