import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import {
  handleInvestigationInspect,
  handleInvestigationList,
  handleInvestigationSummary,
  type InspectOptions,
} from "~/domains/investigation/handle.js";
import type { InspectType } from "~/domains/investigation/types.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

const inspectTypes: InspectType[] = [
  "action",
  "timeline",
  "network",
  "request",
  "snapshot",
  "screenshot",
  "console",
  "log",
];

function parseInspectType(value: string): InspectType {
  if (inspectTypes.includes(value as InspectType)) return value as InspectType;
  throw new Error(`Expected one of: ${inspectTypes.join(", ")}.`);
}

function parseFormat(value: string): "html" | "text" {
  if (value === "html" || value === "text") return value;
  throw new Error("Expected text or html.");
}

function parseSource(value: string): "qawolfTraceCollection" | "serverConsole" {
  if (value === "qawolfTraceCollection" || value === "serverConsole")
    return value;
  throw new Error("Expected qawolfTraceCollection or serverConsole.");
}

export function registerInvestigationCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const investigation = program
    .command("investigation")
    .description("Investigate a finished run attempt from recorded evidence");

  declareCommandKind(investigation.command("list"), "read")
    .description("List finished attempt IDs for a run")
    .requiredOption("--run-id <id>", "Run to discover attempts for")
    .action((options: { runId: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleInvestigationList(ctx, options.runId),
      )(options, command),
    );

  declareCommandKind(investigation.command("summary"), "read")
    .description("Summarize the evidence for one finished attempt")
    .requiredOption("--attempt-id <id>", "Run attempt to investigate")
    .action((options: { attemptId: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleInvestigationSummary(ctx, options.attemptId),
      )(options, command),
    );

  declareCommandKind(investigation.command("inspect"), "read")
    .description("Inspect one kind of evidence for a finished attempt")
    .requiredOption("--attempt-id <id>", "Run attempt to investigate")
    .requiredOption(
      "--type <type>",
      `Evidence type (${inspectTypes.join("|")})`,
      parseInspectType,
    )
    .option("--action-id <id>", "Action evidence ID")
    .option("--evidence-id <id>", "Console or log evidence ID")
    .option("--request-id <id>", "Network request evidence ID")
    .option("--snapshot-id <id>", "Page snapshot evidence ID")
    .option("--screenshot-id <id>", "Screenshot evidence ID")
    .option("--limit <number>", "Maximum entries to return", "20")
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
    .action((options: InspectOptions, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleInvestigationInspect(ctx, options),
      )(options, command),
    );
}
