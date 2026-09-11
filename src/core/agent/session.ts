import type { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

/** A session as `agent.get` reports it. */
export type AgentSession = z.output<typeof publicContractsV1.agent.get.output>;

/** Where the work stands, as `agent.get` reports it. */
export type AgentSessionStatus = AgentSession["status"];

/** One thing the AI has said. */
export type AgentReply = AgentSession["replies"][number];

// Half an hour, past the far end of what the contract calls "minutes to tens of
// minutes". Unlike a runner follow, reading a session costs nothing and holds
// nothing open, so the bound is for the caller that is not a terminal: a CI job
// whose session never settles should fail on its own rather than sit until the
// build is killed.
/** How long `--follow` waits before it stops following. */
export const defaultAgentFollowTimeoutSeconds = 1800;

const settledStatuses: readonly AgentSessionStatus[] = [
  "cancelled",
  "completed",
  "failed",
];

/** Whether the status will not change again, so a follow can stop. */
export function isSettled(status: AgentSessionStatus): boolean {
  return settledStatuses.includes(status);
}

/**
 * The reply a `waiting-for-you` session is blocked on, if there is one.
 *
 * The last reply rather than the last one carrying `choices`, because an
 * open-ended question carries none and is just as blocking. A session that
 * reports `waiting-for-you` with no replies at all is not a state the platform
 * should produce, so it answers undefined and the follow keeps waiting rather
 * than inventing a question to ask.
 */
export function pendingQuestion(
  status: AgentSessionStatus,
  replies: readonly AgentReply[],
): AgentReply | undefined {
  if (status !== "waiting-for-you") return undefined;
  return replies[replies.length - 1];
}
