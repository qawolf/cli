import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import {
  handleInvestigationInspect,
  handleInvestigationList,
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

function parseSource(value: string): "qawolfTraceCollection" | "serverConsole" {
  if (value === "qawolfTraceCollection" || value === "serverConsole")
    return value;
  throw new Error("Expected qawolfTraceCollection or serverConsole.");
}

export function registerAttemptCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const attempt = program
    .command("attempt")
    .description("Investigate a finished run attempt from recorded evidence");

  declareCommandKind(attempt.command("list"), "read")
    .description("List finished attempt IDs for a run")
    .requiredOption("--run-id <id>", "Run to discover attempts for")
    .action((options: { runId: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleInvestigationList(ctx, options.runId),
      )(options, command),
    );

  declareCommandKind(attempt.command("investigate <attemptId>"), "read")
    .description("Summarize the evidence for one finished attempt")
    .action((attemptId: string, _options: unknown, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleInvestigationSummary(ctx, attemptId),
      )({}, command),
    );

  declareCommandKind(attempt.command("inspect <attemptId>"), "read")
    .description("Inspect one kind of evidence for a finished attempt")
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
      "Maximum entries to return: the most recent for --timeline, --network and --log, the earliest for --console",
      "20",
    )
    .option(
      "--start-time-ms <number>",
      "Earliest trace timestamp in milliseconds",
    )
    .option("--end-time-ms <number>", "Latest trace timestamp in milliseconds")
    .option("--start-timestamp <iso>", "Earliest execution log timestamp")
    .option("--end-timestamp <iso>", "Latest execution log timestamp")
    .option("--source <source>", "Execution log source", parseSource)
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
    .action(
      (attemptId: string, options: InspectCommandOptions, command: Command) => {
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
        const normalized = { ...common, ...selection, attemptId };
        return withAuthContext(signals, (ctx) =>
          handleInvestigationInspect(ctx, normalized),
        )(options, command);
      },
    );
}
