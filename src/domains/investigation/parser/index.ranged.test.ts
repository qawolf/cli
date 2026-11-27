import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ArtifactInput,
  InvestigationRequest,
} from "~/domains/investigation/types.js";

import { investigate } from "./index.js";
import { parseRangedPlaywrightTrace } from "./trace/playwrightTrace.js";
import {
  frameJpeg,
  playwrightTraceZip,
} from "./trace/playwrightTraceZip.fixtures.js";
import { memoryRangeReader } from "./zip/zipFixture.testUtils.js";

type Inspect = InvestigationRequest["inspect"];

function wholeInput(zip: Uint8Array): ArtifactInput {
  return { bytes: zip, offset: 0, status: "available" };
}

function rangedInput(zip: Uint8Array) {
  const source = memoryRangeReader(zip);
  const input: ArtifactInput = {
    readRange: source.readRange,
    sizeBytes: zip.length,
    status: "ranged",
  };
  return { input, source };
}

function investigateTrace(trace: ArtifactInput, inspect?: Inspect) {
  return investigate({
    artifacts: { logs: { status: "not-captured" }, trace },
    attempt: {
      attemptId: "attempt-1",
      error: "Timeout waiting for button",
      status: "failed",
    },
    flowId: "flow-1",
    ...(inspect ? { inspect, mode: "inspect" } : { mode: "summary" }),
    runId: "run-1",
  });
}

const inspections: [string, Inspect][] = [
  ["summary", undefined],
  ["timeline", { format: "text", limit: 20, type: "timeline" }],
  [
    "action",
    {
      actionId: "0-trace.trace#0:action:call@2",
      format: "text",
      limit: 20,
      type: "action",
    },
  ],
  ["network", { format: "text", limit: 20, type: "network" }],
  [
    "request",
    {
      format: "text",
      limit: 20,
      requestId: "0-trace.trace#0:network:0",
      type: "request",
    },
  ],
  ["console", { format: "text", limit: 20, type: "console" }],
  [
    "screenshot",
    {
      format: "text",
      limit: 20,
      screenshotId: "0-trace.trace#0:screenshot:7",
      type: "screenshot",
    },
  ],
];

function playwright164Trace() {
  return readFile(join(import.meta.dir, "playwright-1.64.1-trace.fixture.zip"));
}

describe("investigating a trace read by byte range", () => {
  it.each(inspections)(
    "gives the same %s as the whole-file path",
    async (_, inspect) => {
      const zip = playwrightTraceZip({ paddingBytes: 1024 * 1024 });

      const whole = await investigateTrace(wholeInput(zip), inspect);
      const ranged = await investigateTrace(rangedInput(zip).input, inspect);

      expect(ranged).toEqual(whole);
      expect(whole["traceStatus"]).toBe("ready");
    },
  );

  it("gives the same summary as the whole-file path for a real Playwright trace", async () => {
    const zip = await playwright164Trace();

    const whole = await investigateTrace(wholeInput(zip));
    const ranged = await investigateTrace(rangedInput(zip).input);

    expect(ranged).toEqual(whole);
  });

  it("exports the screenshot's bytes from a zip64 trace", async () => {
    const zip = playwrightTraceZip({ zip64: true });

    const result = await investigateTrace(
      rangedInput(zip).input,
      inspections[6]![1],
    );

    expect(Buffer.from(result.binary!.bytesBase64, "base64")).toEqual(
      frameJpeg,
    );
  });

  it("fetches only a small part of the file for a timeline or one screenshot", async () => {
    const zip = playwrightTraceZip({ paddingBytes: 32 * 1024 * 1024 });
    const timeline = rangedInput(zip);
    const screenshot = rangedInput(zip);

    await investigateTrace(timeline.input, inspections[1]![1]);
    await investigateTrace(screenshot.input, inspections[6]![1]);

    expect(timeline.source.bytesRead()).toBeLessThan(zip.length / 1000);
    expect(screenshot.source.bytesRead()).toBeLessThan(zip.length / 1000);
    const firstPaddingName = "resources/padding-0.bin";
    const paddingStart =
      zip.indexOf(firstPaddingName) + firstPaddingName.length;
    const paddingEnd = zip.indexOf("resources/frame.jpeg") - 30;
    const readsPadding = [
      ...timeline.source.reads(),
      ...screenshot.source.reads(),
    ].some(
      ({ length, start }) =>
        start < paddingEnd && start + length > paddingStart,
    );
    expect(readsPadding).toBe(false);
  });

  it("reports a directory over the fetch budget as too large", async () => {
    const zip = playwrightTraceZip();

    const result = await parseRangedPlaywrightTrace(
      { readRange: memoryRangeReader(zip).readRange, sizeBytes: zip.length },
      { zipLimits: { maxFetchedBytes: 64 } },
    );

    expect(result).toEqual({ status: "too-large" });
  });

  it("reports an expired link found while reading the directory", async () => {
    const result = await investigateTrace(
      {
        readRange: async () => ({ status: "expired-url" }),
        sizeBytes: 100 * 1024 * 1024,
        status: "ranged",
      },
      inspections[1]![1],
    );

    expect(result).toEqual({
      attemptId: "attempt-1",
      status: "unavailable",
      traceStatus: "expired-url",
      type: "timeline",
    });
  });
});
