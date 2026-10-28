import { describe, expect, it } from "bun:test";
import { maxAgentWaitSeconds } from "@qawolf/api-contracts/v1";

import { planHold } from "./hold.js";

describe("planHold", () => {
  it("holds for the longest wait the server allows when there is time for it", () => {
    const hold = planHold(() => 600_000);

    expect(hold.waitSeconds).toBe(maxAgentWaitSeconds);
    expect(hold.requestOptions.timeoutMs).toBeGreaterThan(
      maxAgentWaitSeconds * 1_000,
    );
    expect(hold.requestOptions.retryTimeouts).toBe(false);
  });

  it("holds only for the time left, rounded up to a whole second", () => {
    expect(planHold(() => 12_300).waitSeconds).toBe(13);
    expect(planHold(() => 200).waitSeconds).toBe(1);
  });

  it("allows a retry only while a whole further attempt fits before the deadline", () => {
    let remainingMs = 600_000;
    const hold = planHold(() => remainingMs);

    expect(hold.requestOptions.canRetry?.()).toBe(true);
    remainingMs = 30_000;
    expect(hold.requestOptions.canRetry?.()).toBe(false);
  });
});
