import type {
  DeviceAuthorization,
  DeviceTokens,
  PollResponse,
} from "~/core/deviceAuth/types.js";

export const testAuthorization: DeviceAuthorization = {
  deviceCode: "device_abc",
  userCode: "WDJB-MJHT",
  verificationUri: "https://example.com/device",
  verificationUriComplete: "https://example.com/device?user_code=WDJB-MJHT",
  expiresInSec: 300,
  intervalSec: 5,
};

export const testTokens: DeviceTokens = {
  accessToken: "access_abc",
  refreshToken: "refresh_abc",
  expiresAt: 1_700_000_000_000,
  email: "person@example.com",
  organizationId: "org_1",
};

/**
 * A clock that only moves when the code under test sleeps, so polling tests
 * assert real elapsed time without waiting for it.
 */
export function makeFakeClock() {
  let nowMs = 0;
  const slept: number[] = [];
  return {
    now: () => nowMs,
    slept,
    sleep: async (ms: number) => {
      slept.push(ms);
      nowMs += ms;
    },
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

/** Hands back scripted poll answers in order, repeating the last one. */
export function makePoller(responses: PollResponse[]) {
  const calls: string[] = [];
  let index = 0;
  return {
    calls,
    poll: async (deviceCode: string): Promise<PollResponse> => {
      calls.push(deviceCode);
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      if (!response) throw Error("no scripted poll response");
      return response;
    },
  };
}
