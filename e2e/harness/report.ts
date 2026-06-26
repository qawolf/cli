import { intro, log, note, outro } from "@clack/prompts";

import type { CaseResult, ChannelName } from "./types.js";

export type ReportOptions = {
  readonly json: boolean;
};

/**
 * Renders results and returns a process exit code (0 = all passed, 1 = any
 * failed). Clack in a TTY; JSON when `--json` is set or stdout is not a TTY.
 */
export function report(
  results: readonly CaseResult[],
  options: ReportOptions,
): number {
  const exitCode = results.some((result) => !result.passed) ? 1 : 0;
  if (options.json || !process.stdout.isTTY) {
    console.log(JSON.stringify({ results, exitCode }, undefined, 2));
    return exitCode;
  }
  renderClack(results, exitCode);
  return exitCode;
}

function renderClack(results: readonly CaseResult[], exitCode: number): void {
  intro("e2e: repo-readiness");
  if (results.length === 0) {
    note("0 cases — nothing to run (placeholder suite).", "Summary");
    outro("No cases executed.");
    return;
  }
  for (const result of results) {
    log.message(formatResultLine(result));
  }
  note(formatSummary(results), "Summary");
  outro(exitCode === 0 ? "All cases passed." : "Some cases failed.");
}

function formatResultLine(result: CaseResult): string {
  const mark = result.passed ? "✓" : "✗";
  const seconds = (result.durationMs / 1000).toFixed(1);
  const pollution =
    result.pollution.length > 0 ? ` pollution:${result.pollution.length}` : "";
  const reasons = result.passed
    ? ""
    : ` — ${result.assertionFailures.join("; ")}`;
  return `${mark} [${result.channel}] ${result.caseName} (${seconds}s${pollution})${reasons}`;
}

function formatSummary(results: readonly CaseResult[]): string {
  const channels: ChannelName[] = ["node", "binary"];
  return channels
    .map((channel) => summarizeChannel(channel, results))
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function summarizeChannel(
  channel: ChannelName,
  results: readonly CaseResult[],
): string | undefined {
  const forChannel = results.filter((result) => result.channel === channel);
  if (forChannel.length === 0) return undefined;
  const passed = forChannel.filter((result) => result.passed).length;
  return `${channel}: ${passed}/${forChannel.length} passed`;
}
