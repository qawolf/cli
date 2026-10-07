import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import { investigate, redactEvidence } from "./index.js";

describe("investigation parser", () => {
  it("redacts conventional secret fields and signed URLs", () => {
    const value = redactEvidence(
      'authorization: Bearer secret\n{"token":"abc"}\nhttps://x.test/a?x-goog-signature=secret&ok=1\nembedded https://user:synthetic@secret@example.test/path and //user:protocol@secret@example.test/path',
    );
    expect(value).not.toContain("secret");
    expect(value).not.toContain('"abc"');
    expect(value).toContain("[REDACTED]");
  });

  it("redacts escaped and unterminated credential values", () => {
    const escaped = redactEvidence(
      String.raw`payload={\"token\":\"synthetic-secret\"}`,
    );
    const unterminated = redactEvidence(
      'payload={"password":"synthetic-secret[TRUNCATED]',
    );
    expect(escaped).not.toContain("synthetic-secret");
    expect(unterminated).not.toContain("synthetic-secret");
    expect(escaped).toContain("[REDACTED]");
    expect(unterminated).toContain("[REDACTED]");
  });

  it("redacts a JWT that no field name points at", () => {
    const jwt =
      "eyJhbGciOiJSUzI1NiJ9.eyJzaWQiOiJzeW50aGV0aWMifQ.c3ludGhldGljLXNpZw";
    const value = redactEvidence(`0:["$","div"]\n2:T4a3,${jwt}\n3:"visible"`);

    expect(value).not.toContain(jwt);
    expect(value).toContain("2:T4a3,[REDACTED]");
    expect(value).toContain('3:"visible"');
  });

  it("redacts a JWT cut off before its signature", () => {
    const value = redactEvidence(
      "session eyJhbGciOiJSUzI1NiJ9.eyJzaWQiOiJzeW50aGV0aWMifQ",
    );

    expect(value).toBe("session [REDACTED]");
  });

  it.each([
    {
      evidence: "Request failed: {'password': 'hunter2', 'safe': 'visible'}",
      safe: "visible",
      secret: "hunter2",
    },
    {
      evidence: '{"password":123456,"safe":"visible"}',
      safe: "visible",
      secret: "123456",
    },
    {
      evidence: 'fill("abc)secret-password") at visible locator',
      safe: "visible locator",
      secret: "secret-password",
    },
    {
      evidence: `{"password":'mixed-secret',"safe":"visible"}`,
      safe: "visible",
      secret: "mixed-secret",
    },
    {
      evidence: `{'password':"mixed-secret",'safe':'visible'}`,
      safe: "visible",
      secret: "mixed-secret",
    },
    {
      evidence: JSON.stringify(
        JSON.stringify({ password: 123_456, safe: "visible" }),
      ),
      safe: "visible",
      secret: "123456",
    },
    {
      evidence: 'fill(\n  "multiline-secret"\n) visible',
      safe: "visible",
      secret: "multiline-secret",
    },
    {
      evidence: 'fill(unclosed\nvisible type("later-secret")',
      safe: "fill([REDACTED]",
      secret: "later-secret",
    },
  ])("redacts structured credential evidence", ({ evidence, safe, secret }) => {
    const redacted = redactEvidence(evidence);

    expect(redacted).toContain("[REDACTED]");
    expect(redacted).not.toContain(secret);
    expect(redacted).toContain(safe);
  });

  it("preserves malformed trace status", async () => {
    const result = await investigate({
      artifacts: {
        logs: { status: "not-captured" },
        trace: {
          bytes: Buffer.from("not a zip"),
          offset: 0,
          status: "available",
        },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      inspect: { format: "text", limit: 20, type: "timeline" },
      mode: "inspect",
      runId: "run-1",
    });
    expect(result["traceStatus"]).toBe("malformed");
  });

  it("preserves absolute log offsets in a bounded tail", async () => {
    const first = "partial line\n";
    const record = JSON.stringify({
      message:
        "late failure https://user:synthetic@secret@example.test/a and //user:protocol@secret@example.test/b",
      severity: "error",
      source: "serverConsole",
      timestamp: "2026-09-29T00:00:00.000Z",
    });
    const result = await investigate({
      artifacts: {
        logs: {
          bytes: Buffer.from(first + record + "\n"),
          offset: 100,
          status: "available",
        },
        trace: { status: "not-captured" },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      inspect: { format: "text", limit: 20, type: "log" },
      mode: "inspect",
      runId: "run-1",
    });
    const entries = result["entries"] as {
      evidenceId: string;
      message: string;
    }[];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.evidenceId).toBe(
      `log:${100 + Buffer.byteLength(first)}`,
    );
    expect(entries[0]?.message).toBe(
      "late failure https://[REDACTED]@example.test/a and //[REDACTED]@example.test/b",
    );
  });

  it("reports status-zero and failure text as network errors", async () => {
    const zip = new JSZip();
    zip.file("trace.trace", '{"type":"context-options"}\n');
    zip.file(
      "trace.network",
      `${JSON.stringify({
        snapshot: {
          request: { headers: [], method: "GET", url: "https://x.test" },
          response: {
            _failureText: "net::ERR_FAILED token=secret",
            headers: [],
            status: 0,
          },
        },
        type: "resource-snapshot",
      })}\n`,
    );
    const trace = await zip.generateAsync({ type: "uint8array" });
    const result = await investigate({
      artifacts: {
        logs: { status: "not-captured" },
        trace: { bytes: trace, offset: 0, status: "available" },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      mode: "summary",
      runId: "run-1",
    });
    const errors = result["networkErrors"] as {
      items: { failureText: string; status: number }[];
    };
    expect(errors.items).toHaveLength(1);
    expect(errors.items[0]).toMatchObject({
      failureText: "net::ERR_FAILED token=[REDACTED]",
      status: 0,
    });
  });

  it("attributes a trace failure after conventional secret redaction", async () => {
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
          callId: "call@1",
          endTime: 2,
          error: {
            message:
              "request failed https://example.test/a?token=synthetic-secret",
          },
          type: "after",
        },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n") + "\n",
    );
    const trace = await zip.generateAsync({ type: "uint8array" });
    const result = await investigate({
      artifacts: {
        logs: { status: "not-captured" },
        trace: { bytes: trace, offset: 0, status: "available" },
      },
      attempt: {
        attemptId: "attempt-1",
        error: "request failed https://example.test/a?token=[REDACTED]",
        status: "failed",
      },
      flowId: "flow-1",
      mode: "summary",
      runId: "run-1",
    });
    expect(result["failedBrowserActionAttribution"]).toBe(
      "trace-error-matches-attempt",
    );
  });
});
