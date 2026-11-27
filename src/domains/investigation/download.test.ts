import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import { downloadLogTail } from "./download.js";
import { parsePlaywrightTraceArchive } from "./parser/trace/playwrightTrace.js";
import { downloadTrace } from "./traceDownload.js";

describe("investigation artifact downloads", () => {
  it.each([
    [404, "not-found"],
    [403, "expired-url"],
  ] as const)("distinguishes HTTP %s", async (status, expected) => {
    const fetchImpl = (async () =>
      new Response("", { status })) as unknown as typeof fetch;
    const result = await downloadTrace(
      "https://storage.invalid/trace",
      fetchImpl,
    );
    expect(result.status).toBe(expected);
  });

  it("rejects a declared oversize trace without parsing a prefix", async () => {
    const fetchImpl = (async () =>
      new Response("small", {
        headers: { "content-length": String(75 * 1024 * 1024 + 1) },
      })) as unknown as typeof fetch;
    const result = await downloadTrace(
      "https://storage.invalid/trace",
      fetchImpl,
    );
    expect(result).toEqual({ status: "too-large" });
  });

  it("downloads and parses a trace archive at the 75 MiB limit", async () => {
    const limit = 75 * 1024 * 1024;
    const archive = new JSZip();
    archive.file("trace.trace", '{"type":"context-options"}\n');
    archive.file("resources/large-resource", Buffer.alloc(0));
    const emptyArchive = await archive.generateAsync({ type: "nodebuffer" });
    archive.file(
      "resources/large-resource",
      Buffer.alloc(limit - emptyArchive.byteLength),
    );
    const bytes = await archive.generateAsync({ type: "nodebuffer" });
    expect(bytes.byteLength).toBe(limit);
    const fetchImpl = (async () =>
      new Response(bytes)) as unknown as typeof fetch;

    const downloaded = await downloadTrace(
      "https://storage.invalid/trace",
      fetchImpl,
    );

    expect(downloaded.status).toBe("available");
    if (downloaded.status !== "available")
      throw new Error("Expected the trace download to succeed");
    const parsed = await parsePlaywrightTraceArchive(
      Buffer.from(downloaded.bytes),
    );
    expect(parsed.status).toBe("ready");
  });

  it("requests a bounded log tail without authorization", async () => {
    let request: RequestInit | undefined;
    const fetchImpl = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      request = init;
      return new Response("{}\n");
    }) as unknown as typeof fetch;
    await downloadLogTail("https://storage.invalid/logs", fetchImpl);
    expect(request?.headers).toEqual({ range: "bytes=-5242880" });
    expect(request?.headers).not.toHaveProperty("authorization");
  });

  it("reports a timed-out transfer separately from other failures", async () => {
    const timedOutBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.error(new DOMException("timed out", "TimeoutError"));
      },
    });
    const timingOut = (async () =>
      new Response(timedOutBody)) as unknown as typeof fetch;
    const failing = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;

    expect(
      await downloadTrace("https://storage.invalid/trace", timingOut),
    ).toEqual({ status: "timed-out" });
    expect(
      await downloadLogTail("https://storage.invalid/logs", failing),
    ).toEqual({ status: "unavailable" });
  });
});
