import type { OutputMode } from "~/shell/ui/env.js";
import { createAgentReporter } from "./createAgentReporter.js";
import { createConsoleReporter } from "./createConsoleReporter.js";
import { createJsonReporter } from "./createJsonReporter.js";
import type { Reporter } from "./types.js";

type WriteSink = { write: (str: string) => void };

export type SelectReporterDeps = {
  stdout: WriteSink;
  stderr: WriteSink;
};

export function selectReporter(
  mode: OutputMode,
  deps: SelectReporterDeps,
): Reporter {
  switch (mode) {
    case "human":
      return createConsoleReporter({
        stdout: deps.stdout,
        stderr: deps.stderr,
      });
    case "json":
      return createJsonReporter({ stdout: deps.stdout });
    case "agent":
      return createAgentReporter({ stderr: deps.stderr });
  }
}
