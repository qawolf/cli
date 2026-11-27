import { describe, expect, it } from "bun:test";

import { investigate } from "./parser/index.js";
import {
  frameJpeg,
  playwrightTraceZip,
} from "./parser/trace/playwrightTraceZip.fixtures.js";
import { downloadTrace } from "./traceDownload.js";
import type { ArtifactInput, InvestigationRequest } from "./types.js";

const url = "https://storage.invalid/trace.zip?token=secret";
const mebibyte = 1024 * 1024;
const size = 80 * mebibyte;

function wholeBody(zip: Buffer, served: { wholeBytes: number }) {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= zip.length) return controller.close();
      const chunk = zip.subarray(offset, offset + mebibyte);
      offset += chunk.length;
      served.wholeBytes += chunk.length;
      controller.enqueue(chunk);
    },
  });
}

/** Serves the zip like object storage: a 206 for a Range request unless `ignoresRange`, else the whole object. */
function storage(zip: Buffer, options: { ignoresRange?: boolean } = {}) {
  const served = { rangeBytes: 0, ranges: [] as string[], wholeBytes: 0 };
  const fetchImpl = (async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const range = new Headers(init?.headers).get("range") ?? "whole";
    served.ranges.push(range);
    const match = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!match || options.ignoresRange)
      return new Response(wholeBody(zip, served), {
        headers: { "content-length": String(zip.length) },
      });
    const start = Number(match[1]);
    const body = zip.subarray(start, Number(match[2]) + 1);
    served.rangeBytes += body.length;
    return new Response(body, {
      headers: {
        "content-length": String(body.length),
        "content-range": `bytes ${start}-${start + body.length - 1}/${zip.length}`,
      },
      status: 206,
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, served };
}

function inspectTrace(
  trace: ArtifactInput,
  inspect: NonNullable<InvestigationRequest["inspect"]>,
) {
  return investigate({
    artifacts: { logs: { status: "not-captured" }, trace },
    attempt: { attemptId: "attempt-1", status: "failed" },
    flowId: "flow-1",
    inspect,
    mode: "inspect",
    runId: "run-1",
  });
}

describe("downloadTrace", () => {
  it("reads a trace over 75 MiB by range for a timeline and one screenshot", async () => {
    const zip = playwrightTraceZip({ paddingBytes: 76 * mebibyte });
    const { fetchImpl, served } = storage(zip);

    const trace = await downloadTrace(url, fetchImpl);
    if (trace.status !== "ranged") throw new Error(`Got ${trace.status}`);
    const timeline = await inspectTrace(trace, {
      format: "text",
      limit: 20,
      type: "timeline",
    });
    const screenshot = await inspectTrace(trace, {
      format: "text",
      limit: 20,
      screenshotId: "0-trace.trace#0:screenshot:7",
      type: "screenshot",
    });

    expect(trace.sizeBytes).toBe(zip.length);
    expect(timeline).toMatchObject({ traceStatus: "ready", type: "timeline" });
    expect(timeline["actions"]).toHaveLength(2);
    expect(Buffer.from(screenshot.binary!.bytesBase64, "base64")).toEqual(
      frameJpeg,
    );
    expect(served.rangeBytes).toBeLessThan(mebibyte / 10);
    expect(served.wholeBytes).toBeLessThan(4 * mebibyte);
  });

  it("keeps the single whole-file download for a trace at or under 75 MiB", async () => {
    const { fetchImpl, served } = storage(playwrightTraceZip());

    const trace = await downloadTrace(url, fetchImpl);

    expect(trace.status).toBe("available");
    expect(served.ranges).toEqual(["whole"]);
  });

  it("refuses a trace over 75 MiB when storage ignores Range", async () => {
    const zip = playwrightTraceZip({ paddingBytes: 76 * mebibyte });
    const { fetchImpl, served } = storage(zip, { ignoresRange: true });

    expect(await downloadTrace(url, fetchImpl)).toEqual({
      status: "too-large",
    });
    expect(served.ranges).toEqual(["whole", "bytes=0-0"]);
    expect(served.wholeBytes).toBeLessThan(4 * mebibyte);
  });

  it.each([
    [403, "expired-url"],
    [404, "not-found"],
  ] as const)(
    "maps an HTTP %s on the size probe to %s",
    async (status, expected) => {
      const fetchImpl = (async (
        _input: string | URL | Request,
        init?: RequestInit,
      ) =>
        new Headers(init?.headers).has("range")
          ? new Response("", { status })
          : new Response("", {
              headers: { "content-length": String(80 * mebibyte) },
            })) as unknown as typeof fetch;

      expect(await downloadTrace(url, fetchImpl)).toEqual({ status: expected });
    },
  );

  it("refuses a trace whose size storage does not say", async () => {
    const fetchImpl = (async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) =>
      new Headers(init?.headers).has("range")
        ? new Response("P", {
            headers: { "content-range": "bytes 0-0/*" },
            status: 206,
          })
        : new Response("", {
            headers: { "content-length": String(80 * mebibyte) },
          })) as unknown as typeof fetch;

    expect(await downloadTrace(url, fetchImpl)).toEqual({
      status: "too-large",
    });
  });
});

const partial = (body: string, contentRange: string) =>
  new Response(body, {
    headers: { "content-range": contentRange },
    status: 206,
  });

/** Storage that answers the whole-file request and the size probe, then `respond` for every later range read. */
async function rangedTrace(respond: () => Promise<Response>) {
  const fetchImpl = (async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const range = new Headers(init?.headers).get("range");
    if (!range)
      return new Response("", { headers: { "content-length": String(size) } });
    if (range === "bytes=0-0") return partial("P", `bytes 0-0/${size}`);
    return respond();
  }) as unknown as typeof fetch;
  const trace = await downloadTrace(
    "https://storage.invalid/trace.zip",
    fetchImpl,
  );
  if (trace.status !== "ranged") throw new Error(`Got ${trace.status}`);
  return trace;
}

describe("a range read of a trace", () => {
  it("returns exactly the bytes asked for", async () => {
    const trace = await rangedTrace(async () =>
      partial("abcd", `bytes 10-13/${size}`),
    );

    expect(await trace.readRange(10, 4)).toEqual(Buffer.from("abcd"));
    expect(await trace.readRange(10, 0)).toEqual(new Uint8Array());
  });

  it.each([
    [
      "an expired link",
      async () => new Response("", { status: 403 }),
      "expired-url",
    ],
    [
      "an unauthorized read",
      async () => new Response("", { status: 401 }),
      "expired-url",
    ],
    [
      "a deleted object",
      async () => new Response("", { status: 404 }),
      "not-found",
    ],
    [
      "a range past the end",
      async () => new Response("", { status: 416 }),
      "unavailable",
    ],
    [
      "a short read",
      async () => partial("ab", `bytes 10-11/${size}`),
      "unavailable",
    ],
    [
      "a range from elsewhere",
      async () => partial("abcd", `bytes 0-3/${size}`),
      "unavailable",
    ],
    ["a whole-object answer", async () => new Response("abcd"), "too-large"],
    [
      "a timeout",
      async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
      "timed-out",
    ],
    [
      "a network failure",
      async () => {
        throw new TypeError("network down");
      },
      "unavailable",
    ],
  ] as const)("maps %s to %s", async (_, respond, expected) => {
    const trace = await rangedTrace(respond);

    expect(await trace.readRange(10, 4)).toEqual({ status: expected });
  });
});
