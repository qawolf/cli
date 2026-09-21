import { pluralize } from "~/core/pluralize.js";

/** What `qawolf runner actions` says about a sequence. */
export const sequenceMessages = {
  actionsEmpty:
    'The sequence holds no actions. Pass a JSON array of at least one, for example \'[{"type":"click","button":"left","x":480,"y":260},{"type":"type","text":"hello"}]\'.',
  actionsInvalidAt: (index: number, error: string) =>
    `Action ${index} in the sequence was refused: ${error}`,
  stdinEmptySequence:
    'Nothing arrived on stdin. Pipe the sequence in, or pass the JSON array as the argument instead of "-".',
  actionsNotJsonArray:
    'The sequence must be a JSON array of actions, for example \'[{"type":"click","button":"left","x":480,"y":260},{"type":"type","text":"hello"}]\'.',
  actionsEachNeedsAPath:
    "--screenshot-mode each writes one frame per action, so it needs --screenshot <path>; each frame goes to that path with the action's index before the extension.",
  actionsFinalNeedsAPath:
    "--screenshot-mode final asks the runner for one frame after the last action, so it needs --screenshot <path> to write it to. Leave the mode off to perform the actions without a frame.",
  actionsEachToStdout:
    "--screenshot-mode each writes one frame per action, which stdout cannot carry. Give --screenshot a file path.",
  actionsFailedFramesWritten: (paths: readonly string[]) =>
    `${paths.length === 1 ? "Its screen was" : "Its screens were"} written to ${paths.join(", ")}, so look at ${paths.length === 1 ? "that" : "those"} rather than sending anything again.`,
  actionsFailedScreenshotToStdout:
    "Its screen was written to stdout as a JPEG, so look at that rather than sending anything again.",
  actionsPerformed: (count: number) =>
    `Performed ${count} ${count === 1 ? "action" : "actions"}.`,
  actionsPerformedOfTotal: (performed: number, total: number) =>
    `Performed ${String(performed)} of ${pluralize(total, "action")}.`,
  actionsFramesUnwritable: (
    unwritten: readonly { detail: string; path: string }[],
  ) =>
    `The runner answered, but ${pluralize(unwritten.length, "frame")} could not be written: ${unwritten.map(({ detail, path }) => `"${path}" (${detail})`).join(", ")}. Whatever the actions did has already happened, so do not send them again: take the screen with qawolf runner screenshot, giving --out a path this process can write to.`,
  actionsFramesMissing: (indexes: readonly number[]) =>
    `The runner answered without the ${indexes.length === 1 ? "screen" : "screens"} after ${indexes.length === 1 ? "action" : "actions"} ${indexes.join(", ")}, so nothing was written for ${indexes.length === 1 ? "it" : "them"}. Whatever the actions did has already happened, so do not send them again: take the screen with qawolf runner screenshot instead.`,
  actionsPerformedWithoutScreenshot: (count: number) =>
    `Performed ${pluralize(count, "action")}, but the runner answered without the screen it was asked for. Whatever the actions did has already happened, so do not send them again: take the screen with qawolf runner screenshot instead. If this keeps happening, the platform or this CLI is behind the other: upgrade with npm install -g @qawolf/cli.`,
  actionsPerformedFramesWritten: (count: number, paths: string[]) =>
    `Performed ${pluralize(count, "action")} and wrote ${pluralize(paths.length, "screen")} to ${paths.join(", ")}.`,
  actionsPerformedScreenshotToStdout: (count: number) =>
    `Performed ${pluralize(count, "action")} and wrote the runner's screen to stdout as a JPEG. Stdout holds the image bytes alone; this line, and the JSON with --json, is on stderr.`,
  actionsPerformedScreenshotWritten: (count: number, path: string) =>
    `Performed ${count} ${count === 1 ? "action" : "actions"} and wrote the runner's screen to ${path}.`,
  actionsOverLimit: (sent: number, limit: number) =>
    `The sequence holds ${pluralize(sent, "action")}, and one request carries at most ${String(limit)}. Send them in batches, ending each at the action that changes the page.`,
  actionsNotAllSucceeded: (failed: number, total: number) =>
    `${String(failed)} of ${pluralize(total, "action")} did not succeed.`,
  actionsFailedAt: (index: number, type: string | undefined, why: string) =>
    `Action ${index}${type === undefined ? "" : ` (${type})`} ${why}`,
  actionsLeftUnperformed: (count: number) =>
    `${count} ${count === 1 ? "action" : "actions"} after it ${count === 1 ? "was" : "were"} not attempted.`,
  actionsMayHaveHappened:
    "It may have taken effect: take a screenshot before repeating anything from it on.",
  actionsOutOfTime: "was not reached before the sequence ran out of its time.",
  actionsPartlyApplied: (lastCompletedIndex: number) =>
    `The sequence was partly applied: action ${String(lastCompletedIndex)} is the last one that took effect. Do not send it again as a whole; send only what still has to happen as a new request.`,
  actionsUnconfirmed: (errorMessage: string) =>
    `has an unknown effect: ${errorMessage}`,
};
