import { type Command, Option } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import {
  handleInvestigationInspect,
  handleInvestigationSummary,
} from "~/domains/investigation/handle.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import {
  type InspectCommandOptions,
  resolveInspectSelection,
} from "./inspectSelection.js";

function parseFormat(value: string): "html" | "text" {
  if (value === "html" || value === "text") return value;
  throw new Error("Expected text or html.");
}

export function registerAttemptCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const attempt = program
    .command("attempt")
    .description("Investigate a finished run attempt from recorded evidence");

  declareCommandKind(attempt.command("investigate"), "read")
    .description("Summarize the evidence for one finished attempt")
    .requiredOption("--attempt-id <id>", "Attempt to summarize")
    .action((options: { attemptId: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleInvestigationSummary(ctx, options.attemptId),
      )(options, command),
    );

  declareCommandKind(attempt.command("inspect"), "read")
    .description("Inspect one kind of evidence for a finished attempt")
    .requiredOption("--attempt-id <id>", "Attempt to inspect")
    .option("--action <id>", "Inspect one action evidence ID")
    .option("--timeline", "Inspect the action timeline")
    .option("--network", "Inspect network requests")
    .option("--request <id>", "Inspect one network request evidence ID")
    .option("--snapshot <id>", "Inspect one page snapshot evidence ID")
    .option("--screenshot <id>", "Export one screenshot evidence ID")
    .option("--console", "Inspect browser console evidence")
    .option("--log", "Inspect execution log evidence")
    .option("--evidence-id <id>", "Console or log evidence ID")
    .option(
      "--limit <number>",
      "Maximum entries to return, 20 by default and up to 100: the most recent for --timeline, --network and --log, the earliest for --console",
    )
    .option(
      "--start-time-ms <number>",
      "Earliest trace timestamp in milliseconds",
    )
    .option("--end-time-ms <number>", "Latest trace timestamp in milliseconds")
    .option("--start-timestamp <iso>", "Earliest execution log timestamp")
    .option("--end-timestamp <iso>", "Latest execution log timestamp")
    .addOption(
      new Option("--source <source>", "Execution log source").choices([
        "qawolfTraceCollection",
        "serverConsole",
      ]),
    )
    .option("--method <method>", "Network HTTP method")
    .option("--status <code>", "Network HTTP status")
    .option("--url-contains <text>", "Network URL substring")
    .option(
      "--format <format>",
      "Snapshot format (text or html)",
      parseFormat,
      "text",
    )
    .option(
      "--output-file <path>",
      "Write HTML or screenshot bytes without overwriting",
    )
    .action((options: InspectCommandOptions, command: Command) => {
      const selection = resolveInspectSelection(options);
      if ("error" in selection) return command.error(selection.error);
      const {
        action: _action,
        console: _console,
        log: _log,
        network: _network,
        request: _request,
        screenshot: _screenshot,
        snapshot: _snapshot,
        timeline: _timeline,
        ...common
      } = options;
      const normalized = { ...common, ...selection };
      return withAuthContext(signals, (ctx) =>
        handleInvestigationInspect(ctx, normalized),
      )(options, command);
    });
}
