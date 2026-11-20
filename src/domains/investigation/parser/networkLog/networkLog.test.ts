import { describe, expect, it } from "bun:test";

import { networkFailureReason, parseNetworkLog } from "./networkLog.js";
import {
  networkLogFixture,
  networkLogSummaryRow,
  toNdjson,
} from "./networkLog.fixtures.js";

describe("parseNetworkLog", () => {
  it("reads request lines, skips DNS lines and notes the summary", () => {
    const log = parseNetworkLog(
      toNdjson([...networkLogFixture(), networkLogSummaryRow]),
    );

    expect(log.closed).toBe(true);
    expect(log.malformed).toBe(0);
    expect(log.entries.map((entry) => entry.id)).toEqual([
      "a1.1",
      "a1.2",
      "a1.3",
      "a1.5",
      "a1.6",
    ]);
    expect(log.entries[3]).toMatchObject({
      app: "com.example.app",
      failureReason: "http-error",
      method: "POST",
      requestBody: "{}",
      requestHeaders: {
        Authorization: "[REDACTED]",
        "x-request-id": "req-5",
      },
      responseBody: '{"error":"forbidden"}',
      startedAtMilliseconds: Date.parse("2026-11-20T09:00:05.000Z"),
      status: 403,
      url: "https://api.example.test/items/5",
    });
  });

  it("marks a file without its summary line and counts a cut line", () => {
    const bytes = Buffer.concat([
      toNdjson(networkLogFixture()),
      Buffer.from('{"_qawolf":{"kind":"ht'),
    ]);
    const log = parseNetworkLog(bytes);

    expect(log.closed).toBe(false);
    expect(log.malformed).toBe(1);
    expect(log.entries).toHaveLength(5);
  });
});

describe("networkFailureReason", () => {
  it.each([
    ["http", 403, undefined, "http-error"],
    ["http", 200, "context canceled", "canceled"],
    ["http", 0, "unexpected EOF", "interrupted"],
    ["http", 200, undefined, undefined],
    ["encrypted", 0, "EOF", undefined],
    ["connection", 0, "EOF", undefined],
    ["connection", 0, "no such host", "connection-failed"],
    ["encrypted", 0, "read: connection reset by peer", "interrupted"],
    ["connection-failed", 0, "remote error", "connection-failed"],
  ] as const)("%s %d %s → %s", (kind, status, failureText, expected) => {
    expect(networkFailureReason(kind, status, failureText)).toBe(expected);
  });
});
