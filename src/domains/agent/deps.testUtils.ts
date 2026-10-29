import { mock } from "bun:test";
import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";

import type { AgentSessionStatus } from "~/core/agent/session.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeAgentSessionStore } from "~/shell/agent/sessionStore.js";
import { makeAuthCtx as makeShellAuthCtx } from "~/shell/commandContext.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { RequestOptions } from "~/shell/platform/createTrpcClient.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";

import type { AgentDeps } from "./deps.js";

export const testCwd = "/workspace";

type HeldCall<Input> = (
  input: Input,
  options: RequestOptions | undefined,
) => Promise<PlatformResult<unknown>>;

export type HeldReadInput = {
  cursor: string;
  sessionId: string;
  waitSeconds: number;
};

export type ActivityWaitInput = {
  cursors: Record<string, string>;
  sessionIds: string[];
  waitSeconds: number;
};

export function heldRead(
  input: HeldReadInput,
  wokeOn: "reply" | "status" | "timeout",
): PlatformResult<unknown> {
  return {
    ok: true,
    value: {
      nextCursor: input.cursor,
      replies: [],
      sessionId: input.sessionId,
      status: "working",
      url: "https://app.qawolf.com/sessions/sess_1",
      waitSeconds: input.waitSeconds,
      wokeOn,
    },
  };
}

export function activityAnswer(
  input: ActivityWaitInput,
  statuses: Record<string, AgentSessionStatus | "not-found">,
): PlatformResult<unknown> {
  const sessions = input.sessionIds.map((sessionId) => ({
    nextCursor: `cursor-${sessionId}`,
    replies: [],
    sessionId,
    status: statuses[sessionId] ?? "working",
  }));
  return {
    ok: true,
    value: {
      open: {
        cursors: Object.fromEntries(
          sessions.map((watched) => [watched.sessionId, watched.nextCursor]),
        ),
        runIds: [],
        sessionIds: input.sessionIds,
      },
      runs: [],
      sessions,
      waitSeconds: input.waitSeconds,
      wokeOn: sessions.some((watched) => watched.status !== "working")
        ? "activity"
        : "timeout",
    },
  };
}

function isHeldRead(contract: AnyPublicApiContract, input: unknown): boolean {
  return (
    contract.name === "agent.get" &&
    typeof input === "object" &&
    input !== null &&
    "cursor" in input
  );
}

export function makeAuthCtx(...args: Parameters<typeof makeShellAuthCtx>) {
  const made = makeShellAuthCtx(...args);
  const activityWaits = mock<HeldCall<ActivityWaitInput>>(async (input) =>
    activityAnswer(
      input,
      Object.fromEntries(
        input.sessionIds.map((sessionId) => [sessionId, "waiting-for-you"]),
      ),
    ),
  );
  const heldReads = mock<HeldCall<HeldReadInput>>(async (input) =>
    heldRead(input, "reply"),
  );
  const route = (
    contract: AnyPublicApiContract,
    input: unknown,
    options?: RequestOptions,
  ): Promise<PlatformResult<unknown>> => {
    if (contract.name === "activity.wait")
      return activityWaits(input as ActivityWaitInput, options);
    if (isHeldRead(contract, input))
      return heldReads(input as HeldReadInput, options);
    return made.callPublicApi(contract, input, options);
  };
  const platformClient: PlatformClient = {
    ...made.ctx.platformClient,
    callPublicApi: route as PlatformClient["callPublicApi"],
  };
  return {
    ...made,
    activityWaits,
    ctx: { ...made.ctx, platformClient },
    heldReads,
  };
}

export function makeTestDeps(overrides: Partial<AgentDeps> = {}): AgentDeps {
  return {
    env: {},
    now: () => 0,
    sleep: async () => {},
    store: makeAgentSessionStore({ cwd: testCwd, fs: makeMemoryFs() }),
    ...overrides,
  };
}

export type SessionSnapshot = {
  replies?: { askedAt?: string; choices?: string[]; text: string }[];
  status: AgentSessionStatus;
};

/** One `agent.get` answer, with the fields a test does not care about filled in. */
export function session(snapshot: SessionSnapshot): {
  ok: true;
  value: unknown;
} {
  return {
    ok: true,
    value: {
      replies: (snapshot.replies ?? []).map((reply) => ({
        askedAt: reply.askedAt ?? "2026-09-09T12:00:00.000Z",
        text: reply.text,
        ...(reply.choices ? { choices: reply.choices } : {}),
      })),
      nextCursor: "c1",
      sessionId: "sess_1",
      status: snapshot.status,
      url: "https://app.qawolf.com/sessions/sess_1",
    },
  };
}
