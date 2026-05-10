import { type Command, InvalidArgumentError } from "commander";

import { withContext } from "~/lib/context.js";
import type { TraceMode, VideoMode } from "~/types.js";

import { handleFlowsRun } from "./runDefaults.js";
import type { FlowsRunFlags } from "./runInternals.js";

const VIDEO_MODES = ["on", "off", "retain-on-failure"] as const;
const TRACE_MODES = ["on", "off", "retain-on-failure"] as const;

function parseInteger(name: string): (value: string) => number {
  return (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || String(n) !== value) {
      throw new InvalidArgumentError(`${name} must be an integer`);
    }
    return n;
  };
}

function parseEnum<T extends string>(
  name: string,
  values: readonly T[],
): (value: string) => T {
  return (value) => {
    if (!(values as readonly string[]).includes(value)) {
      throw new InvalidArgumentError(
        `${name} must be one of: ${values.join(", ")}`,
      );
    }
    return value as T;
  };
}

export function registerFlowsCommand(program: Command): void {
  const flows = program
    .command("flows")
    .description("Manage and run QA Wolf flows");

  flows
    .command("run [pattern]")
    .description("Run flows matching the pattern")
    .option(
      "--retries <n>",
      "Number of retries on failure",
      parseInteger("--retries"),
      0,
    )
    .option("--bail", "Stop on first failure", false)
    .option(
      "--workers <n>",
      "Number of parallel workers (v0.1 cap: 1)",
      parseInteger("--workers"),
      1,
    )
    .option(
      "--timeout <ms>",
      "Per-flow timeout in milliseconds",
      parseInteger("--timeout"),
      30_000,
    )
    .option(
      "--video <mode>",
      "Video mode: on | off | retain-on-failure",
      parseEnum<VideoMode>("--video", VIDEO_MODES),
      "off" as VideoMode,
    )
    .option(
      "--trace <mode>",
      "Trace mode: on | off | retain-on-failure (accepted; not yet wired to runner)",
      parseEnum<TraceMode>("--trace", TRACE_MODES),
      "off" as TraceMode,
    )
    .option(
      "--output-dir <path>",
      "Output directory for run artifacts",
      "qawolf-output",
    )
    .action(
      (pattern: string | undefined, opts: FlowsRunFlags, command: Command) => {
        return withContext((ctx) => handleFlowsRun(ctx, pattern, opts))(
          opts,
          command,
        );
      },
    );
}
