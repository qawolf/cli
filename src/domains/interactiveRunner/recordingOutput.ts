import type {
  PublicApiOutput,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { recordingMessages } from "~/core/messages/interactiveRunner/recording.js";
import { exitCodes } from "~/shell/exit.js";

type RecordAnswer = PublicApiOutput<typeof publicContractsV1.runner.record>;
type RecordingsAnswer = PublicApiOutput<
  typeof publicContractsV1.runner.recordings
>;

export function recordingFailure(
  reason: Extract<
    RecordAnswer["result"],
    { outcome: "failure" }
  >["failureReason"],
): { error: string; exitCode: number } {
  switch (reason) {
    case "unsupported":
      return {
        error: recordingMessages.unsupported,
        exitCode: exitCodes.invalidArgs,
      };
    case "screen-not-ready":
      return {
        error: recordingMessages.screenNotReady,
        exitCode: exitCodes.invalidArgs,
      };
    case "recording-in-progress":
      return {
        error: recordingMessages.inProgress,
        exitCode: exitCodes.invalidArgs,
      };
    case "recording-not-found":
      return {
        error: recordingMessages.notFound,
        exitCode: exitCodes.notFound,
      };
    case "recording-id-used":
      return {
        error: recordingMessages.idUsed,
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.runnerUnreachable,
        exitCode: exitCodes.network,
      };
    case "recording-failed":
      return {
        error: recordingMessages.failed,
        exitCode: exitCodes.testFailure,
      };
  }
}

export function formatRecordingState(answer: RecordAnswer): string {
  const { result, url } = answer;
  if (result.outcome === "failure")
    return recordingFailure(result.failureReason).error;
  const { active, auto } = result.state;
  const lines = [
    active
      ? `Recording ${active.id} (${active.mode}), started ${active.startedAt}.`
      : "No active recording.",
    `Automatic recording: ${auto}.`,
  ];
  if (result.recording) {
    lines.push(`Recording ${result.recording.id}: ${result.recording.status}.`);
  }
  return [...lines, url].join("\n");
}

export function formatRecordings(answer: RecordingsAnswer): string {
  const lines = answer.recordings.map((recording) =>
    [
      `${recording.id} (${recording.mode}, ${recording.status})`,
      `  ${recording.startedAt} to ${recording.endedAt}`,
      `  ${recording.url}`,
      ...(recording.videoUrl ? [`  Video: ${recording.videoUrl}`] : []),
    ].join("\n"),
  );
  if (lines.length === 0) lines.push("No published recordings found.");
  if (answer.nextPageToken !== undefined) {
    lines.push(
      `Next page token (pass with --page-token): ${answer.nextPageToken}`,
    );
  }
  return lines.join("\n");
}
