import { describe, expect, it } from "bun:test";
import { type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

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

  it("closes the connection of a refused trace instead of draining it", async () => {
    const size = 200 * 1024 * 1024;
    const chunk = Buffer.alloc(64 * 1024);
    const sent = { bytes: 0 };
    const closed: Promise<void>[] = [];
    const stream = (response: ServerResponse, remaining: number): void => {
      if (remaining <= 0) return void response.end();
      sent.bytes += chunk.length;
      if (response.write(chunk))
        return stream(response, remaining - chunk.length);
      response.once("drain", () => stream(response, remaining - chunk.length));
    };
    const server = createServer((_request, response) => {
      closed.push(
        new Promise((resolve) => response.socket?.on("close", resolve)),
      );
      response.writeHead(200, { "content-length": String(size) });
      stream(response, size);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;

    const result = await downloadTrace(`http://127.0.0.1:${port}/trace.zip`);
    await Promise.race([Promise.all(closed), delay(3000)]);
    server.closeAllConnections();
    server.close();

    expect(result).toEqual({ status: "too-large" });
    expect(closed).toHaveLength(2);
    expect(sent.bytes).toBeLessThan(32 * 1024 * 1024);
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
