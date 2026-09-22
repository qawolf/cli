import type { RunnerRecordingCommand } from "@qawolf/api-contracts/v1";

import { recordingMessages } from "~/core/messages/interactiveRunner/recording.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import {
  formatRecordingState,
  formatRecordings,
  recordingFailure,
} from "./recordingOutput.js";
import {
  recordOnRunner,
  readRunnerRecordings,
  type RecordingQuery,
} from "./recordingRequests.js";
import { resolveRunner } from "./resolveRunner.js";

export async function handleRunnerRecord(
  ctx: AuthCommandContext,
  options: {
    command:
      | RunnerRecordingCommand
      | { action: "start"; recordingId?: string | undefined };
    runner: string | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: false, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed")
    return { ...failureFields(resolved), exitCode: resolved.exitCode };

  const command: RunnerRecordingCommand =
    options.command.action === "start"
      ? {
          action: "start",
          recordingId: options.command.recordingId ?? deps.makeRecordingId(),
        }
      : options.command;
  const response = await recordOnRunner(ctx, resolved, command);
  // Preserve the UUID even if the reply is lost: a new UUID would start a
  // different capture, while this one lets the caller identify the first.
  const idNote =
    "recordingId" in command
      ? recordingMessages.recordingId(command.recordingId)
      : undefined;
  if (!response.ok) {
    const fields = failureFields(response);
    return {
      ...fields,
      ...(idNote
        ? { errorBody: [fields.errorBody, idNote].filter(Boolean).join("\n") }
        : {}),
      exitCode: response.exitCode,
    };
  }
  const answer = response.value;
  if (answer.result.outcome === "failure") {
    return {
      ...recordingFailure(answer.result.failureReason),
      errorBody: [idNote, answer.url].filter(Boolean).join("\n"),
    };
  }
  ctx.ui.output(answer, formatRecordingState(answer));
  return undefined;
}

export async function handleRunnerRecordings(
  ctx: AuthCommandContext,
  options: RecordingQuery & { runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: false, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed")
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  const response = await readRunnerRecordings(ctx, resolved, {
    ...(options.recordingId === undefined
      ? {}
      : { recordingId: options.recordingId }),
    ...(options.pageToken === undefined
      ? {}
      : { pageToken: options.pageToken }),
  });
  if (!response.ok)
    return { ...failureFields(response), exitCode: response.exitCode };
  ctx.ui.output(response.value, formatRecordings(response.value));
  return undefined;
}
