import { join } from "node:path";

import { generateJUnit, type JUnitFlowRecord } from "./junitXml.js";
import type { Reporter } from "./types.js";

/**
 * Resolve where the JUnit report is written. A bare `--junit` flag (true) lands
 * the report in the run's output dir; an explicit `--junit <path>` is used as-is.
 * An empty or whitespace-only value (e.g. `--junit=`) falls back to the default.
 */
export function resolveJUnitOutputPath(
  junit: string | boolean,
  outputDir: string,
): string {
  return typeof junit === "string" && junit.trim() !== ""
    ? junit
    : join(outputDir, "junit-report.xml");
}

export type JUnitReporterDeps = {
  /** Path the XML report is written to (absolute, or relative to cwd). */
  outputPath: string;
  /** Synchronous file write — onRunComplete is the runner's last call, so an
   * async write could be lost if the process exits before it flushes. */
  writeFile: (path: string, content: string) => void;
  stderr: { write: (str: string) => void };
};

export function createJUnitReporter(deps: JUnitReporterDeps): Reporter {
  const flows: JUnitFlowRecord[] = [];

  return {
    onFlowPass({ name, path, durationMs }) {
      flows.push({ name, path, status: "pass", durationMs });
    },

    onFlowFail({ name, path, err, durationMs }) {
      flows.push({
        name,
        path,
        status: "fail",
        durationMs,
        error: err.message,
      });
    },

    onRunComplete({ summary }) {
      const xml = generateJUnit(flows, summary.durationMs);
      deps.writeFile(deps.outputPath, xml);
      deps.stderr.write(`JUnit report saved to ${deps.outputPath}\n`);
    },
  };
}
