import { styleText } from "node:util";
import { runnerMessages } from "~/core/messages/index.js";
import type { Reporter } from "./types.js";

type WriteSink = { write: (str: string) => void };

export type ConsoleDeps = {
  stdout: WriteSink;
  stderr: WriteSink;
  /** Terminal column width for the suite separator. Defaults to process.stdout.columns ?? 72. */
  columns?: number;
};

function fmtDuration(ms: number): string {
  return `(${(ms / 1000).toFixed(2)}s)`;
}

function fmtStampLine(manifest: {
  envId: string;
  contentHash: string;
}): string {
  const shortHash = manifest.contentHash.slice(0, 8);
  return `    ${styleText("dim", `env=${manifest.envId} hash=${shortHash}`)}\n`;
}

function filterStack(stack: string): string {
  const cwd = process.cwd();
  return stack
    .split("\n")
    .filter((line) => {
      if (!/^\s+at /.test(line)) return true;
      return !line.includes("node_modules") && !line.includes("dist/cli.js");
    })
    .map((line) => {
      if (!/^\s+at /.test(line)) return line;
      return line.replace(`file://${cwd}/`, "").replace(`${cwd}/`, "");
    })
    .join("\n");
}

function renderCause(cause: unknown): string {
  if (cause instanceof Error) return filterStack(cause.stack ?? cause.message);
  if (typeof cause === "object" && cause !== null) {
    const obj = cause as Record<string, unknown>;
    // Duck-type: if it has a string message, treat it as error-like
    if (typeof obj["message"] === "string") return obj["message"];
    try {
      return JSON.stringify(cause);
    } catch {
      // oxlint-disable-next-line @typescript-eslint/no-base-to-string
      return String(cause);
    }
  }
  return String(cause);
}

function formatErrorWithCause(err: Error): string {
  const parts: string[] = [String(err)];
  let cause: unknown = err.cause;
  while (cause !== undefined && cause !== null) {
    parts.push(`Caused by: ${renderCause(cause)}`);
    if (!(cause instanceof Error)) break;
    cause = cause.cause;
  }
  return parts.join("\n");
}

export function createConsoleReporter(deps: ConsoleDeps): Reporter {
  return {
    onFlowStart({ name, path }) {
      deps.stdout.write(
        `${styleText("magenta", "•")} ${styleText(["bold", "magenta"], name)} ${styleText("dim", path)}\n`,
      );
    },

    onTestResult({ label, status, durationMs }) {
      // err field intentionally unused in v0.1; errors surface at flow level via onFlowFail
      const icon =
        status === "pass" ? styleText("green", "✓") : styleText("red", "✗");
      deps.stdout.write(
        `  - ${label}  ${icon} ${styleText("dim", fmtDuration(durationMs))}\n`,
      );
    },

    onScreenshot({ path }) {
      deps.stdout.write(
        `    ${styleText("dim", runnerMessages.screenshot(path))}\n`,
      );
    },

    onFlowPass({ tests, durationMs, manifest }) {
      const counts =
        tests.total > 0 ? `${tests.passed}/${tests.total} tests ` : "";
      deps.stdout.write(
        `  ${styleText("green", "✓")} ${counts}passed ${styleText("dim", fmtDuration(durationMs))}\n`,
      );
      if (manifest) deps.stdout.write(fmtStampLine(manifest));
    },

    onFlowFail({ err, tests, durationMs, attempt, maxAttempts, manifest }) {
      const errStr = formatErrorWithCause(err);
      const [firstLine, ...restLines] = errStr.split("\n");
      const indent = "    ";
      const formatted = [
        styleText("red", `${indent}${firstLine}`),
        ...restLines.map((line) => styleText("dim", `${indent}${line}`)),
      ].join("\n");
      deps.stderr.write(`${formatted}\n\n`);

      const counts =
        tests.total > 0 ? `${tests.passed}/${tests.total} tests ` : "";
      deps.stdout.write(
        `  ${styleText("red", "✗")} ${counts}passed ${styleText("dim", fmtDuration(durationMs))}\n`,
      );
      if (manifest) deps.stdout.write(fmtStampLine(manifest));

      if (attempt < maxAttempts) {
        deps.stdout.write(
          `\n${runnerMessages.retrying(attempt, maxAttempts)}\n`,
        );
      }
    },

    onRunComplete({ summary }) {
      const total =
        summary.flowsPassed + summary.flowsFailed + summary.flowsSkipped;
      if (total <= 1) return;
      const allPassed = summary.flowsFailed === 0;
      const icon = styleText(
        allPassed ? "green" : "red",
        allPassed ? "✓" : "✗",
      );
      const skippedStr =
        summary.flowsSkipped > 0 ? ` (${summary.flowsSkipped} skipped)` : "";
      const flowCount = `${summary.flowsPassed}/${total} flows passed${skippedStr}`;
      const testCount =
        summary.testsTotal > 0
          ? ` · ${summary.testsPassed}/${summary.testsTotal} tests passed`
          : "";
      const width = deps.columns ?? process.stdout.columns ?? 72;
      deps.stdout.write(`\n${styleText("dim", "─".repeat(width))}\n`);
      deps.stdout.write(
        `  ${icon} ${flowCount}${testCount} ${styleText("dim", fmtDuration(summary.durationMs))}\n`,
      );
    },
  };
}
