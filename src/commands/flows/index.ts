import type { Command } from "commander";

import { withContext } from "~/lib/context.js";
import type { TraceMode, VideoMode } from "~/types.js";

import { handleFlowsRun } from "./runDefaults.js";
import { type FlowsRunFlags, parseEnum, parseInteger } from "./runInternals.js";

const VIDEO_MODES = ["on", "off", "retain-on-failure"] as const;
const TRACE_MODES = ["on", "off", "retain-on-failure"] as const;
const VIDEO_DEFAULT: VideoMode = "off";
const TRACE_DEFAULT: TraceMode = "off";

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
      parseInteger("--retries", { min: 0 }),
      0,
    )
    .option("--bail", "Stop on first failure", false)
    .option(
      "--workers <n>",
      "Number of parallel workers (v0.1 cap: 1)",
      parseInteger("--workers", { min: 1 }),
      1,
    )
    .option(
      "--timeout <ms>",
      "Per-flow timeout in milliseconds",
      parseInteger("--timeout", { min: 0 }),
      30_000,
    )
    .option(
      "--video <mode>",
      "Video mode: on | off | retain-on-failure",
      parseEnum<VideoMode>("--video", VIDEO_MODES),
      VIDEO_DEFAULT,
    )
    .option(
      "--trace <mode>",
      "Trace mode: on | off | retain-on-failure (accepted; not yet wired to runner)",
      parseEnum<TraceMode>("--trace", TRACE_MODES),
      TRACE_DEFAULT,
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
