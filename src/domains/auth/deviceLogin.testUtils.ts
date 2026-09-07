import type {
  DeviceAuthorization,
  DeviceTokens,
  PollResponse,
} from "~/core/deviceAuth/types.js";
import type { DeviceLoginDeps } from "./deviceLogin.js";

export const testIssuer = "https://signin.example";
export const testResource = "https://app.example/api";
export const testBinding = { issuer: testIssuer, resource: testResource };

export function makeJwt(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [encode({ alg: "RS256" }), encode(payload), "sig"].join(".");
}

/** What the device grant answers with: bound to the environment, not the API. */
export const environmentAccessToken = makeJwt({
  iss: testIssuer,
  aud: "client_01ENV",
  exp: 1_700_000_000,
  org_id: "org_1",
});

/** What the resource refresh answers with: the token the API accepts. */
export const boundAccessToken = makeJwt({
  iss: testIssuer,
  aud: testResource,
  exp: 1_700_000_100,
  org_id: "org_1",
});

export const testAuthorization: DeviceAuthorization = {
  deviceCode: "device_abc",
  userCode: "WDJB-MJHT",
  verificationUri: "https://example.com/device",
  verificationUriComplete: "https://example.com/device?user_code=WDJB-MJHT",
  expiresInSec: 300,
  intervalSec: 5,
};

export const deviceGrantTokens: DeviceTokens = {
  accessToken: environmentAccessToken,
  refreshToken: "refresh_from_device",
  expiresAt: 1_700_000_000_000,
  organizationId: "org_1",
};

export const boundTokens: DeviceTokens = {
  accessToken: boundAccessToken,
  refreshToken: "refresh_rotated",
  expiresAt: 1_700_000_100_000,
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

type RefreshResult = Awaited<ReturnType<DeviceLoginDeps["refreshTokens"]>>;
type EmailResult = Awaited<ReturnType<DeviceLoginDeps["fetchEmail"]>>;

export function makeDeps(
  responses: Parameters<typeof makePoller>[0],
  overrides: {
    authorization?: DeviceAuthorization;
    authorizationError?: string;
    isCancelled?: () => boolean;
    refresh?: RefreshResult[];
    email?: EmailResult;
  } = {},
) {
  const clock = makeFakeClock();
  const poller = makePoller(responses);
  const prompted: DeviceAuthorization[] = [];
  const refreshCalls: string[] = [];
  const emailCalls: string[] = [];
  const refreshScript = overrides.refresh ?? [{ ok: true, value: boundTokens }];

  const deps: DeviceLoginDeps = {
    requestAuthorization: async () =>
      overrides.authorizationError
        ? { ok: false, error: overrides.authorizationError }
        : { ok: true, value: overrides.authorization ?? testAuthorization },
    pollToken: poller.poll,
    refreshTokens: async (refreshToken) => {
      refreshCalls.push(refreshToken);
      const next =
        refreshScript[
          Math.min(refreshCalls.length - 1, refreshScript.length - 1)
        ];
      if (!next) throw Error("no scripted refresh response");
      return next;
    },
    binding: testBinding,
    fetchEmail: async (accessToken) => {
      emailCalls.push(accessToken);
      return overrides.email ?? { ok: true, email: "person@example.com" };
    },
    onPrompt: (authorization) => {
      prompted.push(authorization);
    },
    sleep: clock.sleep,
    now: clock.now,
    isCancelled: overrides.isCancelled ?? (() => false),
  };

  return { clock, poller, prompted, refreshCalls, emailCalls, deps };
}

export const approved = { kind: "tokens" as const, tokens: deviceGrantTokens };

export const session = { ...boundTokens, email: "person@example.com" };
