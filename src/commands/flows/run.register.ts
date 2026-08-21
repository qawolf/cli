import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import { declareCommandKind } from "~/commands/commandKind.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import type {
  HarContent,
  HarMode,
  TraceMode,
  VideoMode,
} from "~/core/types.js";
import { defaultOutputDir } from "~/core/paths.js";
import { parseEnum, parseInteger } from "~/domains/runner/runFlagParsers.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";

import { handleFlowsRun } from "./runDefaults.js";
import { handleHybridFlowsRun } from "./hybridRunDefaults.js";
import { withResolvedEnv } from "./withResolvedEnv.js";

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
  declareCommandKind(flows.command("run [pattern]"), "local", {
    kindNote: "read with --env",
  })
    .description(
      "Run flows matching [pattern], or every flow when omitted; with --env, pull missing flows from that QA Wolf environment",
    )
    .option(
      "--retries <n>",
      "Retry each failing flow up to this many times",
      parseInteger("--retries", { min: 0 }),
      0,
    )
    .option("--bail", "Stop the run after the first failure", false)
    .option(
      "--workers <n>",
      "Parallel worker count for web flows",
      parseInteger("--workers", { min: 1 }),
      1,
    )
    .option(
      "--timeout <ms>",
      "Default timeout for actions and assertions, in milliseconds",
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
      "Record Playwright trace: on | off | retain-on-failure",
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
      defaultOutputDir,
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
    .option(
      "--deps <dir>",
      "Use this prepared dependency directory instead of auto-installing the runtime; or set QAWOLF_RUNTIME_DIR to relocate the managed runtime",
    )
    .option(
      "--allow-no-match",
      "Exit 0 instead of 2 when the pattern selects no runnable flow",
      false,
    )
    .option(
      "--no-browser-deps",
      "Skip installing OS-level browser dependencies (Linux --with-deps, which needs root); requires the system libraries to already be present",
    )
    .addHelpText("after", runExamples)
    .action(
      (
        pattern: string | undefined,
        opts: FlowsRunFlags & { env?: string },
        command: Command,
      ) => {
        if (opts.env !== undefined) {
          // Resolution turns an alias into the canonical id before the
          // .qawolf/<env>/ cache lookup, so --env <alias> and --env <id>
          // share one cache directory.
          return withResolvedEnv(
            signals,
            {
              explicit: opts.env,
              requiredMessage: flowsMessages.run.requiresEnv,
            },
            (ctx, env) => handleHybridFlowsRun(ctx, pattern, { ...opts, env }),
          )(opts, command);
        }
        return withContext(signals, (ctx) =>
          handleFlowsRun(ctx, pattern, opts),
        )(opts, command);
      },
    );
}
