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

  // The split that made the timeout visible must not reclassify a failed write.
  it("still returns a network error when the body arrives but the write fails", async () => {
    const fs = makeMemoryFs();
    const cause = new Error("disk full");
    fs.writeFile = mock(() => Promise.reject(cause));

    const result = await fetchSignedUrl(
      { dest: "/assets/file.txt", url },
      { fetch: asFetch(createFetchMock(new Response("bytes"))), fs },
    );

    expect(result).toEqual({ ok: false, error: { cause, kind: "network" } });
  });
});
