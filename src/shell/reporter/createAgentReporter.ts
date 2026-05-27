import { flattenErrorChain } from "./formatError.js";
import type { Reporter } from "./types.js";

type WriteSink = { write: (str: string) => void };

export type AgentReporterDeps = { stderr: WriteSink };

function fmtDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtCounts(tests: { passed: number; total: number }): string {
  return tests.total > 0 ? `${tests.passed}/${tests.total} tests, ` : "";
}

function formatErrorChain(err: Error): string {
  const lines: string[] = [];
  for (const [i, link] of flattenErrorChain(err).entries()) {
    lines.push(
      i === 0 ? `Error: ${link.message}` : `  Caused by: ${link.message}`,
    );
  }
  return lines.join("\n");
}

export function createAgentReporter(deps: AgentReporterDeps): Reporter {
  return {
    onFlowStart({ name, path }) {
      deps.stderr.write(`START   ${name}  ${path}\n`);
    },

    onFlowPass({ name, tests, durationMs }) {
      deps.stderr.write(
        `PASS    ${name}  (${fmtCounts(tests)}${fmtDuration(durationMs)})\n`,
      );
    },

    onFlowFail({ name, err, tests, durationMs, attempt, maxAttempts }) {
      deps.stderr.write(
        `FAIL    ${name}  (${fmtCounts(tests)}${fmtDuration(durationMs)})\n`,
      );
      deps.stderr.write(`${formatErrorChain(err)}\n`);
      if (attempt < maxAttempts) {
        deps.stderr.write(
          `RETRY   ${name}  attempt ${attempt}/${maxAttempts}\n`,
        );
      }
    },

    onRunComplete({ summary }) {
      const total =
        summary.flowsPassed + summary.flowsFailed + summary.flowsSkipped;
      const skippedStr =
        summary.flowsSkipped > 0 ? ` (${summary.flowsSkipped} skipped)` : "";
      const testCount =
        summary.testsTotal > 0
          ? `, ${summary.testsPassed}/${summary.testsTotal} tests passed`
          : "";
      deps.stderr.write(
        `SUMMARY ${summary.flowsPassed}/${total} flows passed${skippedStr}${testCount} (${fmtDuration(summary.durationMs)})\n`,
      );
    },
  };
}
