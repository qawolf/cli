import { describe, expect, it } from "bun:test";

import { FlowRunError } from "./errors.js";
import { parseWorkerResult, serializeWorkerResult } from "./workerProtocol.js";
import type { FlowRunResult } from "./types.js";

describe("workerProtocol", () => {
  it("roundtrips a passing result with manifest", () => {
    const run: FlowRunResult = {
      passed: true,
      testCounts: { passed: 3, total: 3 },
      attempts: 1,
      manifest: { envId: "env_1", path: "a.ts", contentHash: "abc" },
    };

    const parsed = parseWorkerResult(serializeWorkerResult(run, 42));

    expect(parsed.durationMs).toBe(42);
    expect(parsed.run.passed).toBe(true);
    expect(parsed.run.testCounts).toEqual({ passed: 3, total: 3 });
    expect(parsed.run.attempts).toBe(1);
    expect(parsed.run.manifest).toEqual({
      envId: "env_1",
      path: "a.ts",
      contentHash: "abc",
    });
  });

  it("roundtrips a failing result preserving the error and its cause", () => {
    const run: FlowRunResult = {
      passed: false,
      testCounts: { passed: 0, total: 1 },
      attempts: 2,
      error: new FlowRunError("checkout", 2, new Error("locator timeout")),
    };

    const parsed = parseWorkerResult(serializeWorkerResult(run, 7));

    expect(parsed.run.passed).toBe(false);
    expect(parsed.run.attempts).toBe(2);
    const err = parsed.run.error;
    expect(err).toBeInstanceOf(FlowRunError);
    if (err === undefined) throw new Error("expected an error");
    expect(err.flowName).toBe("checkout");
    expect(err.attempt).toBe(2);
    expect(err.cause).toBeInstanceOf(Error);
    expect((err.cause as Error).message).toBe("locator timeout");
  });
});
