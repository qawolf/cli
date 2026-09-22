import { Argument, type Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import {
  handleRunnerRecord,
  handleRunnerRecordings,
} from "~/domains/interactiveRunner/recording.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

type RecordFlags = { runner?: string; recordingId?: string };
type RecordingsFlags = RecordFlags & { pageToken?: string };

export function registerRunnerRecordingCommands(
  runner: Command,
  signals: SignalRegistry,
): void {
  const record = runner
    .command("record")
    .description("Control video recording on a Playwright runner");

  declareCommandKind(record.command("start"), "write")
    .description(
      "Start manual video capture across runs. Requires a ready screen and suppresses automatic capture until stopped",
    )
    .option(
      "--recording-id <uuid>",
      "Recording UUID. Generated when omitted; reuse it when retrying this start",
    )
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: RecordFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRecord(
          ctx,
          {
            command: { action: "start", recordingId: opts.recordingId },
            runner: opts.runner,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(record.command("stop <recording-id>"), "write")
    .description(
      "Stop the recording with this UUID and publish it. Retrying cannot stop a later recording",
    )
    .option("--runner <id>", runnerFlagDescription)
    .action((recordingId: string, opts: RecordFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRecord(
          ctx,
          {
            command: { action: "stop", recordingId },
            runner: opts.runner,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(record.command("status"), "read")
    .description("Show the active recording and automatic recording setting")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: RecordFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRecord(
          ctx,
          {
            command: { action: "status" },
            runner: opts.runner,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(record.command("auto"), "write")
    .addArgument(
      new Argument("<setting>", "Automatic recording setting").choices([
        "on",
        "off",
      ]),
    )
    .description(
      "Enable or disable automatic recording for subsequent full runs",
    )
    .option("--runner <id>", runnerFlagDescription)
    .action((setting: string, opts: RecordFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRecord(
          ctx,
          {
            command: { action: "auto", enabled: setting === "on" },
            runner: opts.runner,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(runner.command("recordings"), "read")
    .description(
      "Read a page of published video recordings, including after the runner terminates. Platform URLs persist; video URLs expire",
    )
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--recording-id <uuid>",
      "Look up one recording; an empty result means it is not published or does not exist",
    )
    .option(
      "--page-token <token>",
      "Continue from nextPageToken returned by the previous page",
    )
    .action((opts: RecordingsFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRecordings(
          ctx,
          {
            runner: opts.runner,
            ...(opts.recordingId === undefined
              ? {}
              : { recordingId: opts.recordingId }),
            ...(opts.pageToken === undefined
              ? {}
              : { pageToken: opts.pageToken }),
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
