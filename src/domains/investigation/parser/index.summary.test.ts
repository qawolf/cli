import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import { investigate } from "./index.js";

describe("investigation summary", () => {
  it("shows which summarized action failed when the attempt error differs", async () => {
    const zip = new JSZip();
    zip.file(
      "trace.trace",
      [
        { type: "context-options" },
        {
          callId: "call@1",
          class: "Frame",
          method: "expect",
          params: { selector: "internal:role=button" },
          startTime: 1,
          type: "before",
        },
        {
          callId: "call@1",
          endTime: 2,
          error: { message: "Expect failed" },
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
        error: "expect(locator).toBeVisible() failed",
        status: "failed",
      },
      flowId: "flow-1",
      mode: "summary",
      runId: "run-1",
    });
    const actions = result["actions"] as { items: unknown[] };

    expect(result["failedBrowserActionAttribution"]).toBe("none");
    expect(actions.items).toEqual([
      expect.objectContaining({
        actionId: "trace.trace#0:action:call@1",
        error: "Expect failed",
        selector: "internal:role=button",
      }),
    ]);
  });
});
