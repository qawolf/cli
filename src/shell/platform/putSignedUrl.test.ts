import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";

import { openFileAsBlob, putSignedUrl } from "./putSignedUrl.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "qawolf-cli-put-"));
  cleanups.push(() => rmSync(dir, { force: true, recursive: true }));
  return dir;
}

function asFetch(value: unknown): typeof globalThis.fetch {
  return value as typeof globalThis.fetch;
}

const url =
  "https://storage.googleapis.com/bucket/app.apk?X-Goog-Signature=abc";
const headers = { "x-goog-if-generation-match": "0" };

describe("putSignedUrl", () => {
  it("PUTs the body once with exactly the signed headers", async () => {
    const fetch = mock<typeof globalThis.fetch>().mockResolvedValue(
      new Response("", { status: 200 }),
    );
    const body = new Blob(["apk bytes"]);

    const result = await putSignedUrl(
      { body, headers, url },
      { fetch: asFetch(fetch) },
    );

    expect(result).toEqual({ ok: true, data: undefined });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe(url);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      body,
      headers,
      method: "PUT",
    });
  });

  it("reports a refusal with its status and body, without retrying", async () => {
    const fetch = mock<typeof globalThis.fetch>().mockResolvedValue(
      new Response("PreconditionFailed", { status: 412 }),
    );

    const result = await putSignedUrl(
      { body: new Blob(["x"]), headers, url },
      { fetch: asFetch(fetch) },
    );

    expect(result).toEqual({
      ok: false,
      error: { body: "PreconditionFailed", kind: "http", status: 412 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a connection failure as a network error", async () => {
    const fetch = mock<typeof globalThis.fetch>().mockRejectedValue(
      new TypeError("fetch failed"),
    );

    const result = await putSignedUrl(
      { body: new Blob(["x"]), headers, url },
      { fetch: asFetch(fetch) },
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("network");
  });

  it("reports a reached deadline as a timeout", async () => {
    const fetch = mock<typeof globalThis.fetch>().mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    const result = await putSignedUrl(
      { body: new Blob(["x"]), headers, url },
      { fetch: asFetch(fetch), timeoutMs: 5 },
    );

    expect(result).toEqual({
      ok: false,
      error: { kind: "timeout", timeoutMs: 5 },
    });
  });
});

describe("openFileAsBlob", () => {
  it("opens a regular file with its size", async () => {
    const path = join(makeTempDir(), "app.apk");
    writeFileSync(path, "apk bytes");

    const blob = await openFileAsBlob(makeDefaultFs(), path);

    expect(blob?.size).toBe(9);
    expect(await blob?.text()).toBe("apk bytes");
  });

  it("answers undefined for a missing path or a directory", async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "app.apk"));

    expect(
      await openFileAsBlob(makeDefaultFs(), join(dir, "missing.apk")),
    ).toBeUndefined();
    expect(
      await openFileAsBlob(makeDefaultFs(), join(dir, "app.apk")),
    ).toBeUndefined();
  });
});
