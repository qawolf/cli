import { makeAgentDeps } from "~/domains/agent/deps.js";
import { sessionIdEnvironmentVariable } from "~/domains/agent/resolveSessionId.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";

export const sessionFlagDescription = `Session to target. Defaults to ${sessionIdEnvironmentVariable}, then the session this directory last started`;

export const timeoutFlagDescription =
  "Give up following after this long. A session that never settles would otherwise hold a CI job open until the build is killed";

/** Binds the handlers' machine dependencies to the real process and filesystem. */
export function agentDeps(
  ctx: AuthCommandContext,
): ReturnType<typeof makeAgentDeps> {
  return makeAgentDeps({
    cwd: process.cwd(),
    env: process.env,
    fs: ctx.fs,
  });
}
