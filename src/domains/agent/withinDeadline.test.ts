import { describe, expect, it, mock } from "bun:test";
import { maxAgentWaitSeconds } from "@qawolf/api-contracts/v1";

import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

import {
  type Deadline,
  holdWithinDeadline,
  readWithinDeadline,
} from "./withinDeadline.js";

type Sent = { requestOptions: RequestOptions; waitSeconds: number };

const unreachable: PlatformResult<string> = {
  error: "socket hang up",
  ok: false,
  unreachable: true,
};
const timedOut: PlatformResult<string> = {
  error: "timed out",
  ok: false,
  timedOut: true,
  unreachable: true,
};

function makeDeadline(remainingMs: number, signal?: AbortSignal) {
  let clock = 0;
  const sleep = mock(async (milliseconds: number) => {
    clock += milliseconds;
  });
  const deadline: Deadline = {
    remainingMs: () => remainingMs - clock,
    signal,
    sleep,
  };
  const advance = (milliseconds: number) => {
    clock += milliseconds;
  };
  const slept = () => sleep.mock.calls.map(([milliseconds]) => milliseconds);
  return { advance, deadline, slept };
}

function scripted(
  answers: PlatformResult<string>[],
  onSend: (plan: Sent) => void = () => {},
) {
  return mock(async (plan: Sent) => {
    onSend(plan);
    return answers.shift() ?? { ok: true as const, value: "answered" };
  });
}

describe("holdWithinDeadline", () => {
  it("holds as long as the server allows, and gives the request longer than the hold", async () => {
    const { deadline } = makeDeadline(600_000);
    const send = scripted([]);

    await holdWithinDeadline(deadline, send);

    const [plan] = send.mock.calls[0] ?? [];
    expect(plan?.waitSeconds).toBe(maxAgentWaitSeconds);
    expect(plan?.requestOptions.timeoutMs).toBeGreaterThan(
      maxAgentWaitSeconds * 1_000,
    );
    expect(plan?.requestOptions.canRetry?.()).toBe(false);
  });

  it("retries a dropped connection with little time left, holding only for what remains", async () => {
    const { advance, deadline, slept } = makeDeadline(20_000);
    const send = scripted([unreachable, unreachable], () => advance(2_000));

    const held = await holdWithinDeadline(deadline, send);

    expect(held).toEqual({ type: "answered", value: "answered" });
    expect(send.mock.calls.map(([plan]) => plan.waitSeconds)).toEqual([
      20, 18, 14,
    ]);
    expect(slept()).toEqual([500, 1_500]);
  });

  it("never sleeps or holds past the deadline", async () => {
    const { deadline, slept } = makeDeadline(1_000);
    const send = scripted([unreachable, unreachable, unreachable]);

    const held = await holdWithinDeadline(deadline, send);

    expect(held).toEqual({ type: "deadline" });
    expect(send.mock.calls.map(([plan]) => plan.waitSeconds)).toEqual([1, 1]);
    expect(slept()).toEqual([500, 500]);
  });

  it("gives up after three holds in a row run out of time", async () => {
    const { advance, deadline, slept } = makeDeadline(1_800_000);
    const send = scripted([timedOut, timedOut, timedOut, timedOut], (plan) =>
      advance(plan.requestOptions.timeoutMs ?? 0),
    );

    const held = await holdWithinDeadline(deadline, send);

    expect(held).toMatchObject({ failure: { timedOut: true }, type: "failed" });
    expect(send).toHaveBeenCalledTimes(3);
    expect(slept()).toEqual([]);
  });

  it("stops retrying once the follow has ended", async () => {
    const abort = new AbortController();
    const { deadline } = makeDeadline(600_000, abort.signal);
    const send = scripted([unreachable, unreachable], () => abort.abort());

    const held = await holdWithinDeadline(deadline, send);

    expect(held.type).toBe("failed");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].requestOptions.signal).toBe(abort.signal);
  });
});

describe("readWithinDeadline", () => {
  it("retries a timed-out read twice, each time bounded by the time left", async () => {
    const { advance, deadline } = makeDeadline(40_000);
    const send = scripted([timedOut, timedOut, timedOut], (plan) =>
      advance(plan.requestOptions.timeoutMs ?? 0),
    );

    const read = await readWithinDeadline(deadline, send);

    expect(read).toEqual({ type: "deadline" });
    expect(
      send.mock.calls.map(([plan]) => plan.requestOptions.timeoutMs),
    ).toEqual([15_000, 15_000, 8_000]);
  });

  it("reports a refusal the platform answered without retrying it", async () => {
    const { deadline } = makeDeadline(40_000);
    const send = scripted([{ error: "Authentication refused", ok: false }]);

    const read = await readWithinDeadline(deadline, send);

    expect(read).toMatchObject({ type: "failed" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
