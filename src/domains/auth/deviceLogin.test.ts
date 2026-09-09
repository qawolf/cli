import { describe, expect, it } from "bun:test";

import type { DeviceAuthorization } from "~/core/deviceAuth/types.js";
import { deviceLogin } from "./deviceLogin.js";
import {
  makeFakeClock,
  makePoller,
  testAuthorization,
  testTokens,
} from "./deviceLogin.testUtils.js";

function makeDeps(
  responses: Parameters<typeof makePoller>[0],
  overrides: {
    authorization?: DeviceAuthorization;
    authorizationError?: string;
    isCancelled?: () => boolean;
  } = {},
) {
  const clock = makeFakeClock();
  const poller = makePoller(responses);
  const prompted: DeviceAuthorization[] = [];

  return {
    clock,
    poller,
    prompted,
    deps: {
      requestAuthorization: async () =>
        overrides.authorizationError
          ? ({ ok: false, error: overrides.authorizationError } as const)
          : ({
              ok: true,
              value: overrides.authorization ?? testAuthorization,
            } as const),
      pollToken: poller.poll,
      onPrompt: (authorization: DeviceAuthorization) => {
        prompted.push(authorization);
      },
      sleep: clock.sleep,
      now: clock.now,
      isCancelled: overrides.isCancelled ?? (() => false),
    },
  };
}

describe("deviceLogin", () => {
  it("returns the tokens once the person approves", async () => {
    const { deps } = makeDeps([{ kind: "tokens", tokens: testTokens }]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: true, tokens: testTokens });
  });

  it("shows the code before polling so the person can act on it", async () => {
    const { deps, prompted, poller } = makeDeps([
      { kind: "tokens", tokens: testTokens },
    ]);

    await deviceLogin(deps);

    expect(prompted).toEqual([testAuthorization]);
    expect(poller.calls).toEqual(["device_abc"]);
  });

  it("waits the advertised interval between polls", async () => {
    const { deps, clock } = makeDeps([
      { kind: "pending" },
      { kind: "pending" },
      { kind: "tokens", tokens: testTokens },
    ]);

    await deviceLogin(deps);

    expect(clock.slept).toEqual([5_000, 5_000]);
  });

  it("backs off further once the server asks it to slow down", async () => {
    const { deps, clock } = makeDeps([
      { kind: "pending" },
      { kind: "slow-down" },
      { kind: "pending" },
      { kind: "tokens", tokens: testTokens },
    ]);

    await deviceLogin(deps);

    expect(clock.slept).toEqual([5_000, 10_000, 10_000]);
  });

  it("rides out a dropped request instead of abandoning the sign-in", async () => {
    const { deps, clock, poller } = makeDeps([
      { kind: "pending" },
      { kind: "unreachable", detail: "socket hang up" },
      { kind: "tokens", tokens: testTokens },
    ]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: true, tokens: testTokens });
    expect(poller.calls.length).toBe(3);
    // 5s as advertised, then doubled after the request that failed.
    expect(clock.slept).toEqual([5_000, 10_000]);
  });

  it("stops with access-denied when the person rejects the request", async () => {
    const { deps } = makeDeps([{ kind: "pending" }, { kind: "denied" }]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({
      ok: false,
      reason: "access-denied",
      detail: undefined,
    });
  });

  it("stops with expired when the device code lapses", async () => {
    const { deps } = makeDeps([{ kind: "expired" }]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: false, reason: "expired", detail: undefined });
  });

  it("times out rather than polling forever against a stalled server", async () => {
    const { deps, poller } = makeDeps([{ kind: "pending" }]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: false, reason: "timeout", detail: undefined });
    // 300s deadline, 5s interval. Poll n happens at (n-1)*5s, so poll 61 lands
    // exactly on the deadline and still counts; poll 62 at 305s is the first
    // past it, and the one that reports the timeout.
    expect(poller.calls.length).toBe(62);
  });

  it("reports the flow unavailable when authorization cannot start", async () => {
    const { deps, poller } = makeDeps([], {
      authorizationError: "device grant not enabled",
    });

    const result = await deviceLogin(deps);

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      detail: "device grant not enabled",
    });
    expect(poller.calls).toEqual([]);
  });

  it("stops without polling when cancelled before it starts", async () => {
    const { deps, poller } = makeDeps(
      [{ kind: "tokens", tokens: testTokens }],
      {
        isCancelled: () => true,
      },
    );

    const result = await deviceLogin(deps);

    expect(result).toEqual({
      ok: false,
      reason: "cancelled",
      detail: undefined,
    });
    expect(poller.calls).toEqual([]);
  });

  it("stops polling as soon as it is cancelled mid-flow", async () => {
    let cancelled = false;
    const { deps, poller } = makeDeps(
      [{ kind: "pending" }, { kind: "tokens", tokens: testTokens }],
      { isCancelled: () => cancelled },
    );
    const wrapped = {
      ...deps,
      sleep: async (ms: number) => {
        cancelled = true;
        await deps.sleep(ms);
      },
    };

    const result = await deviceLogin(wrapped);

    expect(result).toEqual({
      ok: false,
      reason: "cancelled",
      detail: undefined,
    });
    expect(poller.calls.length).toBe(1);
  });
});
