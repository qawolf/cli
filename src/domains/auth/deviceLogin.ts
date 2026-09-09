import { nextPollStep } from "~/core/deviceAuth/pollState.js";
import type {
  DeviceAuthorization,
  DeviceTokens,
  PollFailure,
  PollResponse,
  PollState,
} from "~/core/deviceAuth/types.js";

export type DeviceLoginDeps = {
  requestAuthorization: () => Promise<
    { ok: true; value: DeviceAuthorization } | { ok: false; error: string }
  >;
  pollToken: (deviceCode: string) => Promise<PollResponse>;
  /** Shows the user code and verification URL before polling begins. */
  onPrompt: (authorization: DeviceAuthorization) => void | Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  isCancelled: () => boolean;
};

export type DeviceLoginResult =
  | { ok: true; tokens: DeviceTokens }
  | {
      ok: false;
      reason: PollFailure | "unavailable" | "cancelled";
      detail: string | undefined;
    };

const cancelled: DeviceLoginResult = {
  ok: false,
  reason: "cancelled",
  detail: undefined,
};

/**
 * Runs a device authorization flow to completion.
 *
 * The protocol decisions live in {@link nextPollStep}; this supplies the clock,
 * the socket, and the cancellation check, and writes nothing to storage — a
 * caller that never receives `ok: true` has nothing to clean up.
 */
export async function deviceLogin(
  deps: DeviceLoginDeps,
): Promise<DeviceLoginResult> {
  if (deps.isCancelled()) return cancelled;

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
