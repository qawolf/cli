import type { AgentSessionStatus } from "~/core/agent/session.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeAgentSessionStore } from "~/shell/agent/sessionStore.js";

import type { AgentDeps } from "./deps.js";

export const testCwd = "/workspace";

export { makeAuthCtx } from "~/shell/commandContext.testUtils.js";

// A clock that only moves when the loop sleeps, so a timeout test is exact
// and nothing else waits.
export function makeTestDeps(overrides: Partial<AgentDeps> = {}): AgentDeps {
  let clock = 0;
  return {
    env: {},
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
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
      sessionId: "sess_1",
      status: snapshot.status,
      url: "https://app.qawolf.com/sessions/sess_1",
    },
  };
}
