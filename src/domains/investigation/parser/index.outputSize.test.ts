import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import type { InvestigationRequest } from "~/domains/investigation/types.js";
import { investigate } from "./index.js";

async function noisyAttempt(): Promise<InvestigationRequest> {
  const zip = new JSZip();
  const events = Array.from({ length: 10 }, (_, index) => [
    {
      callId: `call@${index}`,
      class: "Frame",
      method: "click",
      params: { selector: `button[data-step="${index}"]` },
      startTime: index * 10,
      type: "before",
    },
    ...Array.from({ length: 10 }, () => ({
      callId: `call@${index}`,
      message: "waiting for element to be visible, enabled and stable",
      type: "log",
    })),
    {
      callId: `call@${index}`,
      endTime: index * 10 + 1,
      ...(index === 9 && { error: { message: "Checkout button is blocked" } }),
      type: "after",
    },
    {
      messageType: index === 9 ? "error" : "warning",
      text: `Console ${index}: ${"Repeated component stack frame. ".repeat(100)}`,
      type: "console",
    },
  ]).flat();
  zip.file(
    "trace.trace",
    [{ type: "context-options" }, ...events]
      .map((event) => JSON.stringify(event))
      .join("\n") + "\n",
  );
  return {
    artifacts: {
      logs: { status: "not-captured" },
      trace: {
        bytes: await zip.generateAsync({ type: "uint8array" }),
        offset: 0,
        status: "available",
      },
    },
    attempt: {
      attemptId: "checkout-attempt",
      error: "Checkout button is blocked",
      status: "failed",
    },
    flowId: "checkout-flow",
    mode: "summary",
    runId: "checkout-run",
  };
}

describe("investigation summary output size", () => {
  it("keeps noisy traces compact while retaining failure detail and console inspection IDs", async () => {
    const request = await noisyAttempt();
    const result = await investigate(request);
    const consoleEvidence = result["browserConsole"] as {
      coverage: { total: number; returned: number; truncated: boolean };
      items: {
        evidenceId: string;
        message: string;
        evidenceTruncated: boolean;
      }[];
    };
    const latest = consoleEvidence.items.at(-1)!;
    const inspected = await investigate({
      ...request,
      inspect: {
        evidenceId: latest.evidenceId,
        format: "text",
        limit: 20,
        type: "console",
      },
      mode: "inspect",
    });
    const entries = inspected["entries"] as { message: string }[];

    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(8 * 1024);
    const failedAction = result["failedBrowserAction"] as {
      error: string;
      waitingLogs: string[];
    };
    expect(failedAction.error).toBe("Checkout button is blocked");
    expect(failedAction.waitingLogs).toContain(
      "waiting for element to be visible, enabled and stable",
    );
    expect(consoleEvidence.coverage).toMatchObject({
      total: 10,
      returned: 5,
      truncated: true,
    });
    expect(latest.message).toStartWith("Console 9:");
    expect(latest.evidenceTruncated).toBe(true);
    expect(entries[0]!.message.length).toBeGreaterThan(latest.message.length);
  });

  it("keeps successful action details available through inspection", async () => {
    const request = await noisyAttempt();
    const result = await investigate(request);
    const actions = result["actions"] as {
      items: { actionId: string; waitingLogs?: string[] }[];
    };
    const first = actions.items[0]!;
    const inspected = await investigate({
      ...request,
      inspect: {
        actionId: first.actionId,
        format: "text",
        limit: 20,
        type: "action",
      },
      mode: "inspect",
    });

    expect(first.waitingLogs).toBeUndefined();
    const action = inspected["action"] as {
      actionId: string;
      waitingLogs: string[];
    };
    expect(action.actionId).toBe(first.actionId);
    expect(action.waitingLogs).toContain(
      "waiting for element to be visible, enabled and stable",
    );
  });

  it("bounds execution errors without losing their full inspectable record", async () => {
    const message =
      "Checkout request failed: " + "upstream failure details ".repeat(200);
    const request: InvestigationRequest = {
      ...(await noisyAttempt()),
      artifacts: {
        logs: {
          bytes: Buffer.from(
            JSON.stringify({
              message,
              severity: "error",
              source: "serverConsole",
              timestamp: "2026-10-15T07:00:00.000Z",
            }) + "\n",
          ),
          offset: 0,
          status: "available",
        },
        trace: { status: "not-captured" },
      },
    };
    const result = await investigate(request);
    const logs = result["importantExecutionLogs"] as {
      coverage: { truncated: boolean };
      items: {
        evidenceId: string;
        message: string;
        evidenceTruncated: boolean;
      }[];
    };
    const summary = logs.items[0]!;
    const inspected = await investigate({
      ...request,
      inspect: {
        evidenceId: summary.evidenceId,
        format: "text",
        limit: 20,
        type: "log",
      },
      mode: "inspect",
    });

    expect(Buffer.byteLength(summary.message)).toBeLessThanOrEqual(1024);
    expect(summary.evidenceTruncated).toBe(true);
    expect(logs.coverage.truncated).toBe(true);
    expect(inspected["entries"]).toEqual([
      expect.objectContaining({ message }),
    ]);
  });
});
