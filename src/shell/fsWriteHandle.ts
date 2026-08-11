import * as fs from "node:fs";

/**
 * An open file being written incrementally. `write` appends one chunk;
 * `close` releases the descriptor and must be called on every path,
 * including failures.
 */
export type FsWriteHandle = {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

export async function openFsWriteHandle(path: string): Promise<FsWriteHandle> {
  const handle = await fs.promises.open(path, "w");
  return {
    async write(chunk) {
      // POSIX write(2) may write fewer bytes than requested (e.g. near
      // ENOSPC); loop over the unwritten suffix so a short write cannot
      // silently truncate the file.
      let remaining = chunk;
      while (remaining.length > 0) {
        const { bytesWritten } = await handle.write(remaining);
        if (bytesWritten === 0) {
          throw new Error(`write returned 0 bytes for '${path}'`);
        }
        remaining = remaining.subarray(bytesWritten);
      }
    },
    close() {
      return handle.close();
    },
  };
}
