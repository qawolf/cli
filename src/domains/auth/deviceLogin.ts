import { nextPollStep } from "~/core/deviceAuth/pollState.js";
import { verifyTokenBinding } from "~/core/deviceAuth/tokenClaims.js";
import type {
  DeviceAuthorization,
  DeviceTokens,
  PollFailure,
  PollResponse,
  PollState,
} from "~/core/deviceAuth/types.js";
import { authErrorMessages } from "~/core/messages/authErrors.js";

type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; retryable: boolean };

export type DeviceLoginDeps = {
  requestAuthorization: () => Promise<
    { ok: true; value: DeviceAuthorization } | { ok: false; error: string }
  >;
  pollToken: (deviceCode: string) => Promise<PollResponse>;
  /** The resource-bound exchange that turns an approved grant into a session. */
  refreshTokens: (refreshToken: string) => Promise<Outcome<DeviceTokens>>;
  /** What a usable token must be issued by and for. */
  binding: { issuer: string; resource: string };
  /** Asks the API who the token belongs to; its acceptance is the real test. */
  fetchEmail: (
    accessToken: string,
  ) => Promise<{ ok: true; email: string } | { ok: false; error: string }>;
  /** Shows the user code and verification URL before polling begins. */
  onPrompt: (authorization: DeviceAuthorization) => void | Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  isCancelled: () => boolean;
};

type DeviceLoginSession = DeviceTokens & { email: string };

export type DeviceLoginResult =
  | { ok: true; session: DeviceLoginSession }
  | {
      ok: false;
      reason:
        | PollFailure
        | "unavailable"
        | "cancelled"
        | "refresh-failed"
        | "token-rejected"
        | "identity-rejected";
      detail: string | undefined;
    };

type Failure = Extract<DeviceLoginResult, { ok: false }>;

const cancelled: Failure = {
  ok: false,
  reason: "cancelled",
  detail: undefined,
};

/**
 * The refresh happens once, right after approval, with nothing to show the
 * person meanwhile. Bounded so a WorkOS outage ends in a message rather than
 * a spinner; short because the person is sitting there.
 */
const refreshRetryDelaysMs = [1_000, 2_000, 4_000] as const;

async function approve(
  deps: DeviceLoginDeps,
): Promise<{ ok: true; tokens: DeviceTokens } | Failure> {
  const authorization = await deps.requestAuthorization();
  if (!authorization.ok) {
    return { ok: false, reason: "unavailable", detail: authorization.error };
  }

  await deps.onPrompt(authorization.value);

  let state: PollState = {
    intervalMs: authorization.value.intervalSec * 1_000,
    deadlineMs: deps.now() + authorization.value.expiresInSec * 1_000,
  };

  for (;;) {
    if (deps.isCancelled()) return cancelled;

    const response = await deps.pollToken(authorization.value.deviceCode);
    const step = nextPollStep(state, response, deps.now());

    if (step.action === "done") return { ok: true, tokens: step.tokens };
    if (step.action === "fail") {
      return { ok: false, reason: step.reason, detail: step.detail };
    }

    state = step.state;
    await deps.sleep(step.delayMs);
  }
}

async function bind(
  refreshToken: string,
  deps: DeviceLoginDeps,
): Promise<Outcome<DeviceTokens>> {
  let attempt = 0;
  for (;;) {
    const result = await deps.refreshTokens(refreshToken);
    const delay = refreshRetryDelaysMs[attempt];
    if (result.ok || !result.retryable || delay === undefined) return result;
    attempt += 1;
    await deps.sleep(delay);
  }
}

/**
 * Runs a device authorization flow to completion. Approval alone does not end
 * it: WorkOS answers the device grant with a token for the environment client
 * id, which the API refuses, and only a refresh naming the API resource yields
 * a usable one. So the grant's refresh token is spent at once, the result is
 * checked against the binding, and the API is asked to confirm it. Nothing is
 * ever done with the first token, and nothing is written to storage.
 */
export async function deviceLogin(
  deps: DeviceLoginDeps,
): Promise<DeviceLoginResult> {
  if (deps.isCancelled()) return cancelled;

  const approved = await approve(deps);
  if (!approved.ok) return approved;
  if (deps.isCancelled()) return cancelled;

  const bound = await bind(approved.tokens.refreshToken, deps);
  if (!bound.ok) {
    return { ok: false, reason: "refresh-failed", detail: bound.error };
  }

  const binding = verifyTokenBinding(bound.value.accessToken, deps.binding);
  if (!binding.ok) {
    return {
      ok: false,
      reason: "token-rejected",
      detail: authErrorMessages.workos.tokenNotBound(binding.reason),
    };
  }

  const identity = await deps.fetchEmail(bound.value.accessToken);
  if (!identity.ok) {
    return { ok: false, reason: "identity-rejected", detail: identity.error };
  }

  return { ok: true, session: { ...bound.value, email: identity.email } };
}
