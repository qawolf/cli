import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fetchSignedUrl } from "./fetchSignedUrl.js";

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
});
