import type { PollResponse, PollState, PollStep } from "./types.js";

/**
 * The increase lasts for the rest of the flow. Treating it as a one-off skip
 * would return to the very rate the server just objected to.
 */
export const slowDownIncrementMs = 5_000;

/**
 * RFC 8628 asks a client meeting a connection error to slow down before
 * retrying, and recommends doubling. Persists for the rest of the flow: a
 * network that dropped one request is likelier to drop the next.
 */
const unreachableBackoffFactor = 2;

/** Pure, so the protocol is testable without a clock or a socket. */
export function nextPollStep(
  state: PollState,
  response: PollResponse,
  nowMs: number,
): PollStep {
  // Tokens win over the deadline. An approval that lands as the code expires is
  // still an approval, and rejecting it would strand someone who just finished.
  if (response.kind === "tokens") {
    return { action: "done", tokens: response.tokens };
  }

  if (nowMs > state.deadlineMs) {
    return { action: "fail", reason: "timeout", detail: undefined };
  }

  switch (response.kind) {
    case "pending":
      return { action: "poll", delayMs: state.intervalMs, state };

    case "slow-down": {
      const slowed: PollState = {
        intervalMs: state.intervalMs + slowDownIncrementMs,
        deadlineMs: state.deadlineMs,
      };
      return { action: "poll", delayMs: slowed.intervalMs, state: slowed };
    }

    case "denied":
      return { action: "fail", reason: "access-denied", detail: undefined };

    case "expired":
      return { action: "fail", reason: "expired", detail: undefined };

    // Retryable, unlike `error`. The person has often already approved in the
    // browser by now, so abandoning the flow over one dropped request would
    // throw away work they have done and cannot see failing.
    case "unreachable": {
      const backedOff: PollState = {
        intervalMs: state.intervalMs * unreachableBackoffFactor,
        deadlineMs: state.deadlineMs,
      };
      return {
        action: "poll",
        delayMs: backedOff.intervalMs,
        state: backedOff,
      };
    }

    case "error":
      return { action: "fail", reason: "network", detail: response.detail };
  }
}
