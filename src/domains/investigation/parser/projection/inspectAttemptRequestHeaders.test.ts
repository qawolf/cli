import { describe, expect, it } from "bun:test";

import { redactInspectionHeaders } from "./inspectAttemptRequestHeaders.js";

describe("redactInspectionHeaders", () => {
  it("redacts secret-bearing header values and keeps ordinary ones", () => {
    const { headers } = redactInspectionHeaders({
      accept: "text/html",
      authorization: "Bearer abcdef123456",
      "x-client-secret": "xyz",
      "x-session-id": "abc",
    });
    expect(headers).toEqual({
      accept: "text/html",
      authorization: "[REDACTED]",
      "x-client-secret": "[REDACTED]",
      "x-session-id": "[REDACTED]",
    });
  });
});
