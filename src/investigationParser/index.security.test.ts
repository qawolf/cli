import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import { investigate } from "./index.js";

async function snapshotTrace(html: unknown) {
  const zip = new JSZip();
  zip.file(
    "trace.trace",
    [
      { type: "context-options" },
      {
        snapshot: {
          frameId: "frame-1",
          frameUrl: "https://x.test",
          html,
          isMainFrame: true,
          pageId: "page-1",
          snapshotName: "after@call-1",
          timestamp: 1,
        },
        type: "frame-snapshot",
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n") + "\n",
  );
  return zip.generateAsync({ type: "uint8array" });
}

describe("investigation parser security", () => {
  it("filters network inspection by HTTP method and redacts URL userinfo", async () => {
    const zip = new JSZip();
    zip.file("trace.trace", '{"type":"context-options"}\n');
    zip.file(
      "trace.network",
      ["GET", "POST"]
        .map((method) =>
          JSON.stringify({
            snapshot: {
              request: {
                headers: [],
                method,
                url:
                  method === "POST"
                    ? "https://user:synthetic-secret@x.test/post"
                    : "https://x.test/get",
              },
              response: { headers: [], status: 200 },
            },
            type: "resource-snapshot",
          }),
        )
        .join("\n") + "\n",
    );
    const trace = await zip.generateAsync({ type: "uint8array" });
    const result = await investigate({
      artifacts: {
        logs: { status: "not-captured" },
        trace: { bytes: trace, offset: 0, status: "available" },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      inspect: {
        format: "text",
        limit: 20,
        method: "POST",
        type: "network",
      },
      mode: "inspect",
      runId: "run-1",
    });
    const entries = result["entries"] as { method: string; url: string }[];

    expect(entries).toHaveLength(1);
    expect(entries[0]?.method).toBe("POST");
    expect(entries[0]?.url).not.toContain("synthetic-secret");
    expect(entries[0]?.url).toContain("[REDACTED]");
  });

  it("redacts password textarea content from snapshot text metadata", async () => {
    const trace = await snapshotTrace([
      "HTML",
      {},
      ["BODY", {}, ["TEXTAREA", { name: "password" }, "synthetic-secret"]],
    ]);
    for (const format of ["text", "html"] as const) {
      const result = await investigate({
        artifacts: {
          logs: { status: "not-captured" },
          trace: { bytes: trace, offset: 0, status: "available" },
        },
        attempt: { attemptId: "attempt-1", status: "failed" },
        flowId: "flow-1",
        inspect: {
          format,
          limit: 20,
          snapshotId: "trace.trace#0:snapshot:1",
          type: "snapshot",
        },
        mode: "inspect",
        runId: "run-1",
      });

      expect(result["text"]).not.toContain("synthetic-secret");
      expect(result["text"]).toContain("[REDACTED]");
      if (format === "html") {
        const binary = result.binary!;
        const html = Buffer.from(binary.bytesBase64, "base64").toString();
        expect(html).not.toContain("synthetic-secret");
        expect(html).toContain("[REDACTED]");
      }
    }
  });

  it("preserves long DOM text and attributes until the reported final bound", async () => {
    const longText = `${"x".repeat(150)}failure-suffix`;
    const longLabel = `${"y".repeat(60)}label-suffix`;
    const trace = await snapshotTrace([
      "HTML",
      {},
      ["BODY", {}, ["BUTTON", { "aria-label": longLabel }, longText]],
    ]);
    const common = {
      artifacts: {
        logs: { status: "not-captured" },
        trace: { bytes: trace, offset: 0, status: "available" },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      runId: "run-1",
    } as const;
    const inspected = await investigate({
      ...common,
      inspect: {
        format: "text",
        limit: 20,
        snapshotId: "trace.trace#0:snapshot:1",
        type: "snapshot",
      },
      mode: "inspect",
    });
    const summarized = await investigate({ ...common, mode: "summary" });
    const pageState = summarized["pageState"] as {
      text: string;
      truncated: boolean;
    };

    expect(inspected["text"]).toContain("failure-suffix");
    expect(inspected["text"]).toContain("label-suffix");
    expect(inspected["textTruncated"]).toBe(false);
    expect(pageState.text).toContain("failure-suffix");
    expect(pageState.text).toContain("label-suffix");
    expect(pageState.truncated).toBe(false);
  });

  it("does not project an unstructured prefix from a truncated snapshot", async () => {
    const secret = "REVIEW_SYNTHETIC_SECRET";
    const trace = await snapshotTrace([
      "HTML",
      {},
      [
        "BODY",
        {},
        ["TEXTAREA", { name: "password" }, secret],
        ["DIV", {}, "x".repeat(300_000)],
      ],
    ]);
    const common = {
      artifacts: {
        logs: { status: "not-captured" },
        trace: { bytes: trace, offset: 0, status: "available" },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      runId: "run-1",
    } as const;

    for (const format of ["text", "html"] as const) {
      const inspected = await investigate({
        ...common,
        inspect: {
          format,
          limit: 20,
          snapshotId: "trace.trace#0:snapshot:1",
          type: "snapshot",
        },
        mode: "inspect",
      });

      expect(JSON.stringify(inspected)).not.toContain(secret);
      expect(inspected["text"]).toBe("");
      expect(inspected["textTruncated"]).toBe(true);
      if (format === "html") {
        expect(inspected["htmlTruncated"]).toBe(true);
        expect(inspected.binary).toBeUndefined();
      }
    }

    const summarized = await investigate({ ...common, mode: "summary" });
    const pageState = summarized["pageState"] as {
      text: string;
      truncated: boolean;
    };
    expect(JSON.stringify(summarized)).not.toContain(secret);
    expect(pageState.text).toBe("");
    expect(pageState.truncated).toBe(true);
  });
});
