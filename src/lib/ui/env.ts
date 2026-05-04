export type OutputMode = "human" | "json" | "agent";

export type OutputFlags = {
  json?: boolean;
  agent?: boolean;
};

function isCI(env: Record<string, string | undefined>): boolean {
  return Boolean(
    env["CI"] ||
    env["GITHUB_ACTIONS"] ||
    env["GITLAB_CI"] ||
    env["CIRCLECI"] ||
    env["JENKINS_URL"] ||
    env["BUILDKITE"],
  );
}

function isAgentEnvironment(env: Record<string, string | undefined>): boolean {
  return Boolean(env["CLAUDE_CODE"] || env["CURSOR_SESSION_ID"]);
}

export function isInteractive(
  stdinIsTTY: boolean,
  env: Record<string, string | undefined>,
): boolean {
  return stdinIsTTY && !isCI(env);
}

export function detectOutputMode(
  flags: OutputFlags,
  env: Record<string, string | undefined>,
  stdoutIsTTY: boolean,
): OutputMode {
  if (flags.json) return "json";
  if (flags.agent) return "agent";
  if (isAgentEnvironment(env)) return "agent";
  if (isCI(env)) return "json";
  if (stdoutIsTTY) return "human";
  return "json";
}
