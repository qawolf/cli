import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fs from "node:fs";
import type { FileHandle } from "node:fs/promises";

import { openFsWriteHandle } from "./fsWriteHandle.js";

afterEach(() => {
  mock.restore();
});

function asFileHandle(value: unknown): FileHandle {
  return value as FileHandle;
}

describe("openFsWriteHandle", () => {
  // POSIX write(2) may write fewer bytes than requested (e.g. near ENOSPC);
  // a short write must not silently drop the unwritten suffix.
  it("retries the unwritten suffix when the OS reports a short write", async () => {
    const written: number[] = [];
    const shortWritingHandle = {
      write: async (chunk: Uint8Array) => {
        const bytesWritten = Math.min(2, chunk.length);
        written.push(...chunk.subarray(0, bytesWritten));
        return { bytesWritten };
      },
      close: async () => {},
    };
    spyOn(fs.promises, "open").mockResolvedValue(
      asFileHandle(shortWritingHandle),
    );

    const handle = await openFsWriteHandle("/tmp/out.bin");
    await handle.write(new TextEncoder().encode("abcdef"));

    expect(new TextDecoder().decode(new Uint8Array(written))).toBe("abcdef");
  });

  it("fails instead of looping when a write reports zero bytes", async () => {
    const stuckHandle = {
      write: async () => ({ bytesWritten: 0 }),
      close: async () => {},
    };
    spyOn(fs.promises, "open").mockResolvedValue(asFileHandle(stuckHandle));

    const handle = await openFsWriteHandle("/tmp/out.bin");

    expect(handle.write(new TextEncoder().encode("abc"))).rejects.toThrow(
      "0 bytes",
    );
  });
});
