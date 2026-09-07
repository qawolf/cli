import { describe, expect, it } from "bun:test";

import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { deviceLogin } from "./deviceLogin.js";
import {
  approved,
  boundTokens,
  deviceGrantTokens,
  makeDeps,
  makeJwt,
  session,
  testBinding,
} from "./deviceLogin.testUtils.js";

describe("deviceLogin: the resource-bound refresh", () => {
  it("retries a transient fault, then succeeds", async () => {
    const { deps, refreshCalls, clock } = makeDeps([approved], {
      refresh: [
        { ok: false, error: "HTTP 503", retryable: true },
        { ok: true, value: boundTokens },
      ],
    });

    const result = await deviceLogin(deps);

    expect(result).toEqual({ ok: true, session });
    expect(refreshCalls).toEqual([
      "refresh_from_device",
      "refresh_from_device",
    ]);
    expect(clock.slept).toEqual([1_000]);
  });

  it("gives up on a transient fault after a bounded number of attempts", async () => {
    const { deps, refreshCalls, emailCalls } = makeDeps([approved], {
      refresh: [{ ok: false, error: "HTTP 503", retryable: true }],
    });

    const result = await deviceLogin(deps);

    expect(result).toEqual({
      ok: false,
      reason: "refresh-failed",
      detail: "HTTP 503",
    });
    expect(refreshCalls.length).toBe(4);
    expect(emailCalls).toEqual([]);
  });

  it("does not retry a refusal", async () => {
    const { deps, refreshCalls, emailCalls } = makeDeps([approved], {
      refresh: [{ ok: false, error: "invalid_target", retryable: false }],
    });

    const result = await deviceLogin(deps);

    expect(result).toEqual({
      ok: false,
      reason: "refresh-failed",
      detail: "invalid_target",
    });
    expect(refreshCalls.length).toBe(1);
    expect(emailCalls).toEqual([]);
  });

  it.each([
    [
      "still carries the environment audience",
      { ...boundTokens, accessToken: deviceGrantTokens.accessToken },
    ],
    [
      "names another issuer",
      {
        ...boundTokens,
        accessToken: makeJwt({
          iss: "https://other.example",
          aud: testBinding.resource,
          exp: 1,
        }),
      },
    ],
    ["cannot be decoded", { ...boundTokens, accessToken: "garbage" }],
  ] satisfies [string, DeviceTokens][])(
    "rejects a refreshed token that %s without presenting it",
    async (_label, tokens) => {
      const { deps, emailCalls } = makeDeps([approved], {
        refresh: [{ ok: true, value: tokens }],
      });

      const result = await deviceLogin(deps);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("token-rejected");
      expect(emailCalls).toEqual([]);
    },
  );

  it("does not report success when the API rejects the session", async () => {
    const { deps } = makeDeps([approved], {
      email: { ok: false, error: "HTTP 401" },
    });

    const result = await deviceLogin(deps);

    expect(result).toEqual({
      ok: false,
      reason: "identity-rejected",
      detail: "HTTP 401",
    });
  });

  it("stops before the refresh when cancelled during approval", async () => {
    let cancelled = false;
    const { deps, refreshCalls } = makeDeps([{ kind: "pending" }, approved], {
      isCancelled: () => cancelled,
    });
    const wrapped = {
      ...deps,
      pollToken: async (deviceCode: string) => {
        const response = await deps.pollToken(deviceCode);
        if (response.kind === "tokens") cancelled = true;
        return response;
      },
    };

    const result = await deviceLogin(wrapped);

    expect(result.ok).toBe(false);
    expect(refreshCalls).toEqual([]);
  });
});
