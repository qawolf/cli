import { describe, expect, it } from "bun:test";

import { deviceLogin } from "./deviceLogin.js";
import {
  approved,
  boundTokens,
  makeDeps,
  session,
  testAuthorization,
  testBinding,
  testIssuer,
} from "./deviceLogin.testUtils.js";

describe("deviceLogin", () => {
  it("returns the resource-bound session once the person approves", async () => {
    const { deps } = makeDeps([approved]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: true, session });
  });

  // The live failure. The device grant answers with a token whose audience is
  // the environment client id; only the refresh that follows yields one for
  // the API resource. Nothing may be done with the first.
  it("exchanges the device grant's refresh token before using anything", async () => {
    const { deps, refreshCalls, emailCalls } = makeDeps([approved]);

    const result = await deviceLogin(deps);

    expect(refreshCalls).toEqual(["refresh_from_device"]);
    // Identity was asked once, with the bound token, never the first one.
    expect(emailCalls).toEqual([boundTokens.accessToken]);
    if (!result.ok) throw Error("expected success");
    expect(result.session.accessToken).toBe(boundTokens.accessToken);
    expect(result.session.refreshToken).toBe("refresh_rotated");
  });

  it("shows the code before polling so the person can act on it", async () => {
    const { deps, prompted, poller } = makeDeps([approved]);

    await deviceLogin(deps);

    expect(prompted).toEqual([testAuthorization]);
    expect(poller.calls).toEqual(["device_abc"]);
  });

  it("waits the advertised interval between polls", async () => {
    const { deps, clock } = makeDeps([
      { kind: "pending" },
      { kind: "pending" },
      approved,
    ]);

    await deviceLogin(deps);

    expect(clock.slept).toEqual([5_000, 5_000]);
  });

  it("backs off further once the server asks it to slow down", async () => {
    const { deps, clock } = makeDeps([
      { kind: "pending" },
      { kind: "slow-down" },
      { kind: "pending" },
      approved,
    ]);

    await deviceLogin(deps);

    expect(clock.slept).toEqual([5_000, 10_000, 10_000]);
  });

  it("rides out a dropped request instead of abandoning the sign-in", async () => {
    const { deps, clock, poller } = makeDeps([
      { kind: "pending" },
      { kind: "unreachable", detail: "socket hang up" },
      approved,
    ]);

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: true, session });
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
    const { deps, poller } = makeDeps([approved], { isCancelled: () => true });

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
    const { deps, poller } = makeDeps([{ kind: "pending" }, approved], {
      isCancelled: () => cancelled,
    });
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

  it("carries the issuer it was bound against", () => {
    // Guards the fixture: every token above claims this issuer.
    expect(testBinding.issuer).toBe(testIssuer);
  });
});
