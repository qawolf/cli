import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import { makeDrippingBodyFetch } from "./slowFetch.testUtils.js";

afterEach(() => {
  mock.restore();
});

const url =
  "https://storage.googleapis.com/bucket/file.tar.gz?X-Goog-Signature=abc";

function createFetchMock(response: Response) {
  return mock<typeof fetch>().mockResolvedValue(response);
}

function asFetch(value: unknown): typeof fetch {
  return value as typeof fetch;
}

describe("fetchSignedUrl disk interaction", () => {
  // Streaming to disk keeps peak memory at one chunk, not 2× the file size —
  // large assets must not be buffered whole before writing.
  it("streams each chunk to disk as it arrives instead of buffering the body", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/assets", { recursive: true });
    const chunkWrites: number[] = [];
    const openWriteHandle = fs.openWriteHandle.bind(fs);
    fs.openWriteHandle = async (path) => {
      const handle = await openWriteHandle(path);
      return {
        write: async (chunk) => {
          chunkWrites.push(chunk.length);
          await handle.write(chunk);
        },
        close: handle.close,
      };
    };

    const result = await fetchSignedUrl(
      { dest: "/assets/file.bin", url },
      {
        fetch: makeDrippingBodyFetch(["ab", "cd", "ef"], 10),
        fs,
        stallTimeoutMs: 200,
      },
    );

    expect(result).toEqual({ ok: true, data: undefined });
    expect(chunkWrites).toEqual([2, 2, 2]);
    expect(await fs.readFile("/assets/file.bin")).toBe("abcdef");
    expect(await fs.pathExists("/assets/file.bin.part")).toBe(false);
  });

  // The stall clock measures the network, not the disk: a write that outlasts
  // the window must not abort a download whose bytes keep arriving.
  it("does not count slow disk writes toward the stall window", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/assets", { recursive: true });
    const openWriteHandle = fs.openWriteHandle.bind(fs);
    fs.openWriteHandle = async (path) => {
      const handle = await openWriteHandle(path);
      return {
        write: async (chunk) => {
          await new Promise((resolve) => setTimeout(resolve, 80));
          await handle.write(chunk);
        },
        close: handle.close,
      };
    };

    const result = await fetchSignedUrl(
      { dest: "/assets/file.bin", url },
      {
        fetch: makeDrippingBodyFetch(["ab", "cd"], 10),
        fs,
        stallTimeoutMs: 50,
      },
    );

    expect(result).toEqual({ ok: true, data: undefined });
    expect(await fs.readFile("/assets/file.bin")).toBe("abcd");
  });

  // An early error return must not leave the transfer running: nothing else
  // ever cancels it, so the connection would stay open and Bun would keep
  // buffering the body in the background.
  it("aborts the request when the destination file cannot be opened", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/assets", { recursive: true });
    const cause = new Error("permission denied");
    fs.openWriteHandle = () => Promise.reject(cause);
    const fetchSpy = createFetchMock(new Response("bytes"));

    const result = await fetchSignedUrl(
      { dest: "/assets/file.txt", url },
      { fetch: asFetch(fetchSpy), fs },
    );

    expect(result).toEqual({ ok: false, error: { cause, kind: "network" } });
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("aborts the request when a chunk write fails", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/assets", { recursive: true });
    const cause = new Error("disk full");
    fs.openWriteHandle = async () => ({
      write: () => Promise.reject(cause),
      close: async () => {},
    });
    const fetchSpy = createFetchMock(new Response("bytes"));

    const result = await fetchSignedUrl(
      { dest: "/assets/file.txt", url },
      { fetch: asFetch(fetchSpy), fs },
    );

    expect(result).toEqual({ ok: false, error: { cause, kind: "network" } });
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  // Failed local writes must not reclassify as network stalls, and a partial
  // file must not survive the failure.
  it("returns a network error and removes the partial file when a write fails", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/assets", { recursive: true });
    const cause = new Error("disk full");
    fs.openWriteHandle = async () => ({
      write: () => Promise.reject(cause),
      close: async () => {},
    });

    const result = await fetchSignedUrl(
      { dest: "/assets/file.txt", url },
      { fetch: asFetch(createFetchMock(new Response("bytes"))), fs },
    );

    expect(result).toEqual({ ok: false, error: { cause, kind: "network" } });
    expect(await fs.pathExists("/assets/file.txt")).toBe(false);
    expect(await fs.pathExists("/assets/file.txt.part")).toBe(false);
  });
});
