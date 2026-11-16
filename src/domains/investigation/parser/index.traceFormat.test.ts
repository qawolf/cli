import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import JSZip from "jszip";

import type { InvestigationRequest } from "~/domains/investigation/types.js";

import { investigate } from "./index.js";

async function investigateTrace(
  trace: Uint8Array,
  inspect?: InvestigationRequest["inspect"],
) {
  return investigate({
    artifacts: {
      logs: { status: "not-captured" },
      trace: { bytes: trace, offset: 0, status: "available" },
    },
    attempt: { attemptId: "attempt-1", status: "failed" },
    flowId: "flow-1",
    ...(inspect ? { inspect, mode: "inspect" } : { mode: "summary" }),
    runId: "run-1",
  });
}

async function expectScreenshotAndSnapshot(trace: Uint8Array) {
  const summary = await investigateTrace(trace);
  const pageState = summary["pageState"] as
    | { screenshotId: string; snapshotId: string }
    | undefined;
  expect(pageState?.screenshotId).toBeDefined();
  expect(pageState?.snapshotId).toBeDefined();
  const screenshot = await investigateTrace(trace, {
    format: "text",
    limit: 20,
    screenshotId: pageState?.screenshotId,
    type: "screenshot",
  });
  const snapshot = await investigateTrace(trace, {
    format: "text",
    limit: 20,
    snapshotId: pageState?.snapshotId,
    type: "snapshot",
  });
  const jpeg = Buffer.from(screenshot.binary!.bytesBase64, "base64");

  expect(screenshot["status"]).toBe("available");
  expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect(snapshot["status"]).toBe("available");
  expect(snapshot["text"]).toContain("Save");
}

async function expectResponseBody(trace: Uint8Array) {
  const network = await investigateTrace(trace, {
    format: "text",
    limit: 20,
    type: "network",
  });
  const [entry] = network["entries"] as { requestId: string }[];
  const request = await investigateTrace(trace, {
    format: "text",
    limit: 20,
    requestId: entry!.requestId,
    type: "request",
  });

  expect(request["body"]).toEqual(
    expect.objectContaining({
      status: "available",
      text: "<button>Save</button>",
    }),
  );
}

function playwright164Trace() {
  return readFile(join(import.meta.dir, "playwright-1.64.1.trace.zip"));
}

async function legacyTrace() {
  const playwright164 = await JSZip.loadAsync(await playwright164Trace());
  const zip = new JSZip();
  zip.file(
    "trace.trace",
    [
      { type: "context-options" },
      {
        callId: "call@1",
        class: "Frame",
        method: "click",
        startTime: 1,
        type: "before",
      },
      {
        snapshot: {
          callId: "call@1",
          frameId: "frame-1",
          frameUrl: "https://app.test/",
          html: ["HTML", {}, ["BODY", {}, ["BUTTON", {}, "Save"]]],
          isMainFrame: true,
          pageId: "page-1",
          snapshotName: "after@call@1",
          timestamp: 2,
        },
        type: "frame-snapshot",
      },
      {
        height: 48,
        pageId: "page-1",
        sha1: "frame.jpeg",
        timestamp: 2,
        type: "screencast-frame",
        width: 64,
      },
      { callId: "call@1", endTime: 3, type: "after" },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n") + "\n",
  );
  zip.file(
    "trace.network",
    JSON.stringify({
      snapshot: {
        request: { headers: [], method: "GET", url: "https://app.test/" },
        response: {
          content: { _sha1: "body.html", mimeType: "text/html" },
          headers: [{ name: "Content-Type", value: "text/html" }],
          status: 200,
        },
      },
      type: "resource-snapshot",
    }) + "\n",
  );
  const frameName = Object.keys(playwright164.files).find((name) =>
    name.startsWith("screencast/"),
  );
  zip.file(
    "resources/frame.jpeg",
    await playwright164.file(frameName!)!.async("uint8array"),
  );
  zip.file("resources/body.html", "<button>Save</button>");
  return zip.generateAsync({ type: "uint8array" });
}

describe("investigation trace formats", () => {
  it("finds screenshots and snapshots in a Playwright 1.64 trace", async () => {
    await expectScreenshotAndSnapshot(await playwright164Trace());
  });

  it("reads response bodies from a Playwright 1.64 trace", async () => {
    await expectResponseBody(await playwright164Trace());
  });

  it("finds screenshots and snapshots in a trace from before Playwright 1.64", async () => {
    await expectScreenshotAndSnapshot(await legacyTrace());
  });

  it("reads response bodies from a trace from before Playwright 1.64", async () => {
    await expectResponseBody(await legacyTrace());
  });
});
