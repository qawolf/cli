import { sessionGivenTwice } from "~/core/messages/index.js";
import { resolveIdFrom } from "~/core/resolveId.js";

import type { AgentDeps } from "./deps.js";

export const sessionIdEnvironmentVariable = "QAWOLF_SESSION_ID";

// The id is takeable two ways because both read naturally: `agent get <id>`
// beside `agent send <message>`, and `--session` for a script that builds its
// arguments. Two ways to say one thing is worth a rule when they disagree, so
// naming the session twice with two different ids is refused rather than
// silently resolved in favour of one.
/** The session named on the command line, from its argument and its flag. */
export function chooseGivenSessionId(given: {
  argument: string | undefined;
  flag: string | undefined;
}): { ok: true; sessionId: string | undefined } | { ok: false; error: string } {
  const { argument, flag } = given;
  if (argument !== undefined && flag !== undefined && argument !== flag) {
    return { error: sessionGivenTwice(argument, flag), ok: false };
  }
  return { ok: true, sessionId: argument ?? flag };
}

/** The session a command means: given, else the environment, else the last one this workspace started. */
export const resolveSessionId = (
  session: string | undefined,
  deps: AgentDeps,
): Promise<string | undefined> =>
  resolveIdFrom({
    env: deps.env,
    environmentVariable: sessionIdEnvironmentVariable,
    given: session,
    readStored: deps.store.readLastSessionId,
  });
