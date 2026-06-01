import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import type {
  HarContent,
  HarMode,
  TraceMode,
  VideoMode,
} from "~/core/types.js";
import { parseEnum, parseInteger } from "~/domains/runner/runFlagParsers.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";

import { handleFlowsRun } from "./runDefaults.js";
import { handleHybridFlowsRun } from "./hybridRunDefaults.js";

const videoModes = ["on", "off", "retain-on-failure"] as const;
const traceModes = ["on", "off", "retain-on-failure"] as const;
const harModes = ["on", "off", "retain-on-failure"] as const;
const harContentModes = ["full", "omit"] as const;
const videoDefault: VideoMode = "off";
const traceDefault: TraceMode = "off";
const harDefault: HarMode = "off";
const harContentDefault: HarContent = "omit";

const runExamples = `
Examples:
  $ qawolf flows run
  $ qawolf flows run "flows/checkout/**"
  $ qawolf flows run --retries 2 --video retain-on-failure
  $ qawolf flows run checkout --env staging --headed`;

export function registerFlowsRunCommand(
  flows: Command,
  signals: SignalRegistry,
): void {
  flows
    .command("run [pattern]")
    .description("Run flows matching [pattern], or every flow when omitted")
    .option(
      "--retries <n>",
      "Retry each failing flow up to this many times",
      parseInteger("--retries", { min: 0 }),
      0,
    )
    .option("--bail", "Stop the run after the first failure", false)
    .option(
      "--workers <n>",
      "Parallel worker count (capped at 1 in v0.1)",
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
      "Record video: on | off | retain-on-failure",
      parseEnum<VideoMode>("--video", videoModes),
      videoDefault,
    )
    .option(
      "--trace <mode>",
      "Record Playwright trace: on | off | retain-on-failure (capture pending)",
      parseEnum<TraceMode>("--trace", traceModes),
      traceDefault,
    )
    .option(
      "--har <mode>",
      "Record HAR network log: on | off | retain-on-failure",
      parseEnum<HarMode>("--har", harModes),
      harDefault,
    )
    .option(
      "--har-content <mode>",
      "HAR response bodies: omit | full (full uses more memory)",
      parseEnum<HarContent>("--har-content", harContentModes),
      harContentDefault,
    )
    .option(
      "--output-dir <path>",
      "Directory for run artifacts (videos, traces, HAR)",
      "qawolf-output",
    )
    .option(
      "--junit [path]",
      "Write a JUnit XML report (default: <output-dir>/junit-report.xml)",
    )
    .option("--headed", "Show the browser window instead of headless", false)
    .option(
      "--env <env>",
      "Pull and run a flow from this environment (UUID or slug) if not cached locally",
    )
    .addHelpText("after", runExamples)
    .action(
      (
        pattern: string | undefined,
        opts: FlowsRunFlags & { env?: string },
        command: Command,
      ) => {
        if (opts.env !== undefined) {
          const hybridFlags = { ...opts, env: opts.env };
          return withAuthContext(signals, (ctx) =>
            handleHybridFlowsRun(ctx, pattern, hybridFlags),
          )(opts, command);
        }
        return withContext(signals, (ctx) =>
          handleFlowsRun(ctx, pattern, opts),
        )(opts, command);
      },
    );
}
