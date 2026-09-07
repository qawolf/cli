import { describe, expect, it } from "bun:test";

import { nextPollStep, slowDownIncrementMs } from "./pollState.js";
import type { DeviceTokens, PollState } from "./types.js";

const state: PollState = { intervalMs: 5_000, deadlineMs: 300_000 };

const tokens: DeviceTokens = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: undefined,
  organizationId: undefined,
};

describe("nextPollStep", () => {
  it("finishes when the response carries tokens", () => {
    const step = nextPollStep(state, { kind: "tokens", tokens }, 0);

    expect(step).toEqual({ action: "done", tokens });
  });

  it("finishes on tokens even after the deadline has passed", () => {
    const step = nextPollStep(state, { kind: "tokens", tokens }, 300_001);

    expect(step).toEqual({ action: "done", tokens });
  });

  it("polls again at the current interval while authorization is pending", () => {
    const step = nextPollStep(state, { kind: "pending" }, 0);

    expect(step).toEqual({ action: "poll", delayMs: 5_000, state });
  });

  it("raises the interval by five seconds on slow-down", () => {
    const step = nextPollStep(state, { kind: "slow-down" }, 0);

    expect(step).toEqual({
      action: "poll",
      delayMs: 5_000 + slowDownIncrementMs,
      state: { intervalMs: 5_000 + slowDownIncrementMs, deadlineMs: 300_000 },
    });
  });

  it("keeps the raised interval for later pending responses", () => {
    const slowed = nextPollStep(state, { kind: "slow-down" }, 0);
    if (slowed.action !== "poll") throw Error("expected to keep polling");

    const step = nextPollStep(slowed.state, { kind: "pending" }, 0);

    expect(step).toEqual({
      action: "poll",
      delayMs: 10_000,
      state: slowed.state,
    });
  });

  it("fails when the person rejects the request", () => {
    const step = nextPollStep(state, { kind: "denied" }, 0);

    expect(step).toEqual({
      action: "fail",
      reason: "access-denied",
      detail: undefined,
    });
  });

  it("fails when the device code expires", () => {
    const step = nextPollStep(state, { kind: "expired" }, 0);

    expect(step).toEqual({
      action: "fail",
      reason: "expired",
      detail: undefined,
    });
  });

  it("times out once the deadline passes, however long the server stalls", () => {
    const step = nextPollStep(state, { kind: "pending" }, 300_001);

    expect(step).toEqual({
      action: "fail",
      reason: "timeout",
      detail: undefined,
    });
  });

  it("keeps polling at the deadline itself", () => {
    const step = nextPollStep(state, { kind: "pending" }, 300_000);

    expect(step).toEqual({ action: "poll", delayMs: 5_000, state });
  });

  it("retries a server it could not reach, at double the interval", () => {
    const step = nextPollStep(state, { kind: "unreachable", detail: "x" }, 0);

    expect(step).toEqual({
      action: "poll",
      delayMs: 10_000,
      state: { intervalMs: 10_000, deadlineMs: 300_000 },
    });
  });

  it("doubles again while it still cannot reach the server", () => {
    const first = nextPollStep(state, { kind: "unreachable", detail: "x" }, 0);
    if (first.action !== "poll") throw Error("expected to keep polling");

    const second = nextPollStep(
      first.state,
      { kind: "unreachable", detail: "x" },
      0,
    );

    expect(second).toEqual({
      action: "poll",
      delayMs: 20_000,
      state: { intervalMs: 20_000, deadlineMs: 300_000 },
    });
  });

  it("keeps the backed-off interval once the server answers again", () => {
    const backedOff = nextPollStep(
      state,
      { kind: "unreachable", detail: "x" },
      0,
    );
    if (backedOff.action !== "poll") throw Error("expected to keep polling");

    const step = nextPollStep(backedOff.state, { kind: "pending" }, 0);

    expect(step).toEqual({
      action: "poll",
      delayMs: 10_000,
      state: backedOff.state,
    });
  });

  it("stops retrying an unreachable server once the deadline passes", () => {
    const step = nextPollStep(
      state,
      { kind: "unreachable", detail: "x" },
      300_001,
    );

    expect(step).toEqual({
      action: "fail",
      reason: "timeout",
      detail: undefined,
    });
  });

  it("fails with the detail from an unexpected error", () => {
    const step = nextPollStep(state, { kind: "error", detail: "boom" }, 0);

    expect(step).toEqual({
      action: "fail",
      reason: "network",
      detail: "boom",
    });
  });
});
