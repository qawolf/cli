import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import {
  makeDrippingBodyFetch,
  makeStallingBodyFetch,
  makeTimingOutBodyFetch,
} from "./slowFetch.testUtils.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  mock.restore();
  while (cleanups.length > 0) cleanups.pop()?.();
});

const url =
  "https://storage.googleapis.com/bucket/file.tar.gz?X-Goog-Signature=abc";

function createTempDest(): string {
  const dir = mkdtempSync(join(tmpdir(), "qawolf-cli-test-"));
  cleanups.push(() => rmSync(dir, { force: true, recursive: true }));
  return join(dir, "bundle.tar.gz");
}

function createFetchMock(response: Response) {
  return mock<typeof fetch>().mockResolvedValue(response);
}

function asFetch(value: unknown): typeof fetch {
  return value as typeof fetch;
}

describe("fetchSignedUrl", () => {
  it("sends a plain GET to the signed URL with no auth headers", async () => {
    const dest = createTempDest();
    const fetchSpy = createFetchMock(new Response("bytes", { status: 200 }));

    await fetchSignedUrl({ dest, url }, { fetch: asFetch(fetchSpy) });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(url);
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toBeUndefined();
  });

  it("writes the response body to dest on 200", async () => {
    const dest = createTempDest();

    const result = await fetchSignedUrl(
      { dest, url },
      {
        fetch: asFetch(
          createFetchMock(new Response("hello bytes", { status: 200 })),
        ),
      },
    );

    expect(result).toEqual({ ok: true, data: undefined });
    expect(readFileSync(dest, "utf8")).toBe("hello bytes");
  });

  it("writes through the injected fs dependency", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/assets", { recursive: true });

    const result = await fetchSignedUrl(
      { dest: "/assets/file.txt", url },
      {
        fetch: asFetch(createFetchMock(new Response("memory bytes"))),
        fs,
      },
    );

    expect(result).toEqual({ ok: true, data: undefined });
    expect(await fs.readFile("/assets/file.txt")).toBe("memory bytes");
  });

  it("returns http error on 403 (URL expired)", async () => {
    const dest = createTempDest();

    const result = await fetchSignedUrl(
      { dest, url },
      {
        fetch: asFetch(
          createFetchMock(new Response("Forbidden", { status: 403 })),
        ),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { body: "Forbidden", kind: "http", status: 403 },
    });
  });

  it("returns network error when fetch throws", async () => {
    const dest = createTempDest();
    const cause = new Error("connection refused");
    const fetchSpy = mock<typeof fetch>().mockRejectedValue(cause);

    const result = await fetchSignedUrl(
      { dest, url },
      { fetch: asFetch(fetchSpy) },
    );

    expect(result).toEqual({
      ok: false,
      error: { cause, kind: "network" },
    });
  });

  // A download stalls part-way far more often than it fails to start, and the
  // deadline covers the bytes as well as the headers.
  it("returns a timeout when the download stalls part-way through the body", async () => {
    const dest = createTempDest();

    const result = await fetchSignedUrl(
      { dest, url },
      { fetch: makeTimingOutBodyFetch() },
    );

    expect(result).toEqual({
      ok: false,
      error: { kind: "timeout", timeoutMs: 30_000 },
    });
  });

  // The window is a stall timeout, not a whole-download deadline: it fires only
  // when no bytes arrive for its duration.
  it("returns a timeout when no data arrives within the stall window", async () => {
    const dest = createTempDest();

    const result = await fetchSignedUrl(
      { dest, url },
      { fetch: makeStallingBodyFetch(["first bytes"]), stallTimeoutMs: 50 },
    );

    expect(result).toEqual({
      ok: false,
      error: { kind: "timeout", timeoutMs: 50 },
    });
  });

  // A large asset on a slow link takes longer than any fixed deadline; as long
  // as bytes keep arriving the download must be allowed to finish.
  it("succeeds when the download outlasts the stall window but keeps making progress", async () => {
    const dest = createTempDest();

    const result = await fetchSignedUrl(
      { dest, url },
      {
        fetch: makeDrippingBodyFetch(["a", "b", "c", "d", "e", "f"], 40),
        stallTimeoutMs: 100,
      },
    );

    expect(result).toEqual({ ok: true, data: undefined });
    expect(readFileSync(dest, "utf8")).toBe("abcdef");
  });

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
