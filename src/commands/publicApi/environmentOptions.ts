import type { Command } from "commander";

import type { CommandSpec } from "~/domains/publicApi/commandSpecs.js";

// Generated options a variable can fill, keyed by contract path and input path
// (`public.run.create.aiTaskId`) or by input path alone, which covers the field
// wherever it appears (`environmentId`).
const optionEnvironmentVariables = new Map([
  ["environmentId", "QAWOLF_ENVIRONMENT"],
  ["public.run.create.aiTaskId", "QAWOLF_AI_TASK_ID"],
  ["public.run.create.chatSessionId", "QAWOLF_CHAT_SESSION_ID"],
]);

export function optionEnvironmentVariable(
  spec: CommandSpec,
  path: string[],
): string | undefined {
  const dotted = path.join(".");
  return (
    optionEnvironmentVariables.get(`${spec.trpcPath}.${dotted}`) ??
    optionEnvironmentVariables.get(dotted)
  );
}

// A pair of options a contract refuses together, where both can arrive from
// the environment. An AI task pod that holds a conversation exports
// QAWOLF_AI_TASK_ID and QAWOLF_CHAT_SESSION_ID at once, and `run.create`
// rejects a request carrying both, since a task already implies its own chat
// session. `keep` is the one that survives when both are ambient: the id such
// a pod sends today, whose conversation is that same chat session.
const exclusiveOptions = new Map<string, { keep: string; drop: string }>([
  ["public.run.create", { keep: "aiTaskId", drop: "chatSessionId" }],
]);

/**
 * Drops the ambient half of a pair the contract refuses together, so a shell
 * that exports both variables still gets a request the contract accepts.
 *
 * An explicit flag outranks a variable. Two explicit flags are left as typed:
 * the contract then reports the contradiction the caller asked for.
 */
export function withoutExclusiveConflict(
  spec: CommandSpec,
  command: Command,
  options: Record<string, unknown>,
): Record<string, unknown> {
  const pair = exclusiveOptions.get(spec.trpcPath);
  if (!pair) return options;
  if (options[pair.keep] === undefined || options[pair.drop] === undefined) {
    return options;
  }
  const fromEnvironment = (key: string): boolean =>
    command.getOptionValueSource(key) === "env";
  if (!fromEnvironment(pair.keep) && !fromEnvironment(pair.drop)) {
    return options;
  }
  const dropped = fromEnvironment(pair.drop) ? pair.drop : pair.keep;
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => key !== dropped),
  );
}
