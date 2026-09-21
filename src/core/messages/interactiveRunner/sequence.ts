import { pluralize } from "~/core/pluralize.js";

/** What `qawolf runner actions` says about a sequence. */
export const sequenceMessages = {
  actionsEmpty:
    'The sequence holds no actions. Pass a JSON array of at least one, for example \'[{"type":"click","button":"left","x":480,"y":260},{"type":"type","text":"hello"}]\'.',
  actionsInvalidAt: (index: number, error: string) =>
    `Action ${index} in the sequence was refused: ${error}`,
  actionsNotJsonArray:
    'The sequence must be a JSON array of actions, for example \'[{"type":"click","button":"left","x":480,"y":260},{"type":"type","text":"hello"}]\'.',
  actionsEachNeedsAPath:
    "--screenshot-mode each writes one frame per action, so it needs --screenshot <path>; each frame goes to that path with the action's index before the extension.",
  actionsFinalNeedsAPath:
    "--screenshot-mode final asks the runner for one frame after the last action, so it needs --screenshot <path> to write it to. Leave the mode off to perform the actions without a frame.",
  actionsEachToStdout:
    "--screenshot-mode each writes one frame per action, which stdout cannot carry. Give --screenshot a file path.",
  actionsPerformed: (count: number) =>
    `Performed ${count} ${count === 1 ? "action" : "actions"}.`,
  actionsFramesUnwritable: (
    unwritten: readonly { detail: string; path: string }[],
  ) =>
    `The runner answered, but ${pluralize(unwritten.length, "frame")} could not be written: ${unwritten.map(({ detail, path }) => `"${path}" (${detail})`).join(", ")}. Whatever the actions did has already happened, so do not send them again: take the screen with qawolf runner screenshot, giving --out a path this process can write to.`,
  actionsPerformedFramesWritten: (count: number, paths: string[]) =>
    `Performed ${pluralize(count, "action")} and wrote ${pluralize(paths.length, "screen")} to ${paths.join(", ")}.`,
  actionsPerformedScreenshotToStdout: (count: number) =>
    `Performed ${pluralize(count, "action")} and wrote the runner's screen to stdout as a JPEG. Stdout holds the image bytes alone; this line, and the JSON with --json, is on stderr.`,
  actionsPerformedScreenshotWritten: (count: number, path: string) =>
    `Performed ${count} ${count === 1 ? "action" : "actions"} and wrote the runner's screen to ${path}.`,
  actionsNotAllSucceeded: (failed: number, total: number) =>
    `${String(failed)} of ${pluralize(total, "action")} did not succeed.`,
  actionsFailedAt: (index: number, type: string | undefined, why: string) =>
    `Action ${index}${type === undefined ? "" : ` (${type})`} ${why}`,
  actionsLeftUnperformed: (count: number) =>
    `${count} ${count === 1 ? "action" : "actions"} after it ${count === 1 ? "was" : "were"} not attempted.`,
  actionsMayHaveHappened:
    "It may have taken effect: take a screenshot before repeating anything from it on.",
  actionsOutOfTime:
    "was not reached before the sequence ran out of its time. Send the rest as a new request.",
  actionsUnconfirmed: (errorMessage: string) =>
    `has an unknown effect: ${errorMessage}`,
};
