import { describe, expect, it } from "bun:test";

import { downloadLogTail, downloadTrace } from "./download.js";

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
        headers: { "content-length": String(50 * 1024 * 1024 + 1) },
      })) as unknown as typeof fetch;
    const result = await downloadTrace(
      "https://storage.invalid/trace",
      fetchImpl,
    );
    expect(result).toEqual({ status: "too-large" });
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
});
