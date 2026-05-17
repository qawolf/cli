import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import type { TraceMode, VideoMode } from "~/core/types.js";

import { handleFlowsList } from "~/domains/flows/list.js";
import {
  type FlowsPullOptions,
  handleFlowsPull,
} from "~/domains/flows/pull/handler.js";
import { handleFlowsRun } from "./runDefaults.js";
import {
  type FlowsRunFlags,
  parseEnum,
  parseInteger,
} from "~/domains/runner/runInternals.js";

const videoModes = ["on", "off", "retain-on-failure"] as const;
const traceModes = ["on", "off", "retain-on-failure"] as const;
const videoDefault: VideoMode = "off";
const traceDefault: TraceMode = "off";

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
      parseEnum<VideoMode>("--video", videoModes),
      videoDefault,
    )
    .option(
      "--trace <mode>",
      "Trace mode: on | off | retain-on-failure (accepted; not yet wired to runner)",
      parseEnum<TraceMode>("--trace", traceModes),
      traceDefault,
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

  flows
    .command("list [pattern]")
    .description(
      "List flow files matched by [pattern] (all flows when omitted)",
    )
    .action((pattern: string | undefined, opts: unknown, command: Command) =>
      withContext((ctx) => handleFlowsList(ctx, pattern))(opts, command),
    );

  flows
    .command("pull")
    .description("Download an environment's flows into .qawolf/<env>/")
    .requiredOption("--env <env>", "Environment ID (UUID or kebab-case slug)")
    .option("--out <path>", "Override the .qawolf/<env>/ destination")
    .option("--yes", "Skip the overwrite prompt for locally-modified files")
    .action((opts: FlowsPullOptions, command: Command) => {
      return withContext((ctx) => handleFlowsPull(ctx, opts))(opts, command);
    });
}
