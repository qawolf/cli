import { maxAgentWaitSeconds } from "@qawolf/api-contracts/v1";

import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";
import {
  type PlatformFailure,
  type PlatformResult,
  failureFields,
} from "~/shell/platform/requestWithRetry.js";

const answerMarginMs = 15_000;
const readTimeoutMs = 15_000;
const retryBackoffMs = [500, 1_500] as const;
const maxConsecutiveTimeouts = 3;

export type Deadline = {
  remainingMs: () => number;
  signal: AbortSignal | undefined;
  sleep: (ms: number) => Promise<void>;
};

type Plan = { requestOptions: RequestOptions; waitSeconds: number };

type Send<Value> = (plan: Plan) => Promise<PlatformResult<Value>>;

export type Ended =
  | { type: "deadline" }
  | { failure: PlatformFailure; type: "failed" };

type Attempt<Value> = { type: "answered"; value: Value } | Ended;

function planAttempt(
  remainingMs: number,
  holds: boolean,
  signal: AbortSignal | undefined,
): Plan {
  const waitSeconds = holds
    ? Math.min(maxAgentWaitSeconds, Math.max(1, Math.ceil(remainingMs / 1_000)))
    : 0;
  const timeoutMs = Math.min(
    holds ? waitSeconds * 1_000 + answerMarginMs : readTimeoutMs,
    remainingMs,
  );
  return {
    requestOptions: {
      canRetry: () => false,
      timeoutMs,
      ...(signal ? { signal } : {}),
    },
    waitSeconds,
  };
}

async function callWithinDeadline<Value>(
  deadline: Deadline,
  holds: boolean,
  send: Send<Value>,
): Promise<Attempt<Value>> {
  for (let retry = 0; ; retry++) {
    const remainingMs = deadline.remainingMs();
    if (remainingMs <= 0) return { type: "deadline" };
    const result = await send(planAttempt(remainingMs, holds, deadline.signal));
    if (result.ok) return { type: "answered", value: result.value };
    if (deadline.remainingMs() <= 0) return { type: "deadline" };
    const backoffMs = retryBackoffMs[retry];
    const retryable =
      result.unreachable === true && !(holds && result.timedOut === true);
    if (backoffMs === undefined || !retryable || deadline.signal?.aborted)
      return { failure: result, type: "failed" };
    await deadline.sleep(Math.min(backoffMs, deadline.remainingMs()));
    if (deadline.signal?.aborted) return { failure: result, type: "failed" };
  }
}

export function readWithinDeadline<Value>(
  deadline: Deadline,
  send: Send<Value>,
): Promise<Attempt<Value>> {
  return callWithinDeadline(deadline, false, send);
}

export async function holdWithinDeadline<Value>(
  deadline: Deadline,
  send: Send<Value>,
): Promise<Attempt<Value>> {
  for (let timeouts = 1; ; timeouts++) {
    const held = await callWithinDeadline(deadline, true, send);
    if (
      held.type !== "failed" ||
      held.failure.timedOut !== true ||
      timeouts >= maxConsecutiveTimeouts
    )
      return held;
  }
}

export function endedBy(ended: Ended, timedOut: CommandResult): CommandResult {
  if (ended.type === "deadline") return timedOut;
  return { exitCode: exitCodes.network, ...failureFields(ended.failure) };
}
