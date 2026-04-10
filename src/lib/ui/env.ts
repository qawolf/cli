export type OutputMode = "human" | "json" | "agent";

export type OutputFlags = {
  json?: boolean;
  agent?: boolean;
};

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY) && !isCI();
}

function isCI(): boolean {
  return Boolean(
    process.env["CI"] ||
    process.env["GITHUB_ACTIONS"] ||
    process.env["GITLAB_CI"] ||
    process.env["CIRCLECI"] ||
    process.env["JENKINS_URL"] ||
    process.env["BUILDKITE"],
  );
}

function isAgentEnvironment(): boolean {
  return Boolean(
    process.env["CLAUDE_CODE"] || process.env["CURSOR_SESSION_ID"],
  );
}

export function detectOutputMode(flags: OutputFlags): OutputMode {
  if (flags.json) return "json";
  if (flags.agent) return "agent";
  if (isAgentEnvironment()) return "agent";
  if (isCI()) return "json";
  if (process.stdout.isTTY) return "human";
  return "json";
}
