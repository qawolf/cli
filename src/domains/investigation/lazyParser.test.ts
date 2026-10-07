import { describe, expect, it } from "bun:test";

import { loadInvestigationParser } from "./lazyParser.js";

describe("loadInvestigationParser", () => {
  it("loads the parser from source without a build", async () => {
    const parser = await loadInvestigationParser();
    const result = await parser.investigate({
      artifacts: {
        logs: { status: "not-captured" },
        trace: { status: "not-captured" },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      mode: "summary",
      runId: "run-1",
    });
    expect(result["traceStatus"]).toBe("not-captured");
  });
});
