import { pluralize } from "~/core/pluralize.js";

export const interactMessages = {
  actionFailed: (errorMessage: string) =>
    `The action reached the runner and did not take effect: ${errorMessage}`,
  actionFlagsWithStdin:
    '"-" reads the whole action from stdin, so an action flag passed alongside it would be ignored. Pipe the action in on its own, or name the action type and use flags.',
  actionMayHaveHappened:
    "The runner could not be reached, which does not mean the action was not performed: it may have stopped answering mid-action. Take a screenshot before repeating it.",
  actionNotJson:
    'Stdin did not hold a JSON action. Pipe one object, for example \'{"type":"click","button":"left","x":480,"y":260}\'.',
  actionNotSupportedOnMobile: (type: string) =>
    `A mobile runner has a touchscreen, so it cannot perform ${type} as asked. It taps with a left-button click, swipes with drag, and types into whatever the last tap focused.`,
  actionPerformed: (type: string) => `Performed ${type}.`,
  actionAnsweredUnknown: (failureReason: string) =>
    `The runner answered "${failureReason}", which this version of the CLI does not know how to report. Upgrade with npm install -g @qawolf/cli.`,
  screenshotAnsweredUnknown: (failureReason: string) =>
    `The runner answered "${failureReason}", which this version of the CLI does not know how to report. Upgrade with npm install -g @qawolf/cli.`,
  runnerHasNoScreen:
    "This runner does not run a browser on a virtual desktop, so there is nothing about it to see or drive. Retrying will never help: launch a playwright runner instead.",
  runnerHasNoScreenToEvaluate:
    "The runner could not evaluate the snippet. This covers a runner that is still starting or busy, and also one with no live page to evaluate against: a freshly launched runner has no page until a run opens one, so run a flow on it with qawolf runner run first. If it is not a runner that runs a browser at all, this will never clear. It is not proof the snippet did not run, so do not resubmit one that mutates the page without reading qawolf runner events console first.",
  inspectNeedsABrowserRunner:
    "This runner is a mobile device, and element and page HTML are a browser's shapes. Retrying will never help. Launch a playwright runner to inspect one.",
  nothingToInspect: (errorMessage: string | undefined) =>
    `The runner had nothing to inspect${errorMessage === undefined ? "" : `: ${errorMessage}`}. There is no live page, nothing matched the selector, or no variable has that name; a runner cannot tell those apart. Run a flow on it first, or check the selector or name.`,
  inspectAnsweredUnknown: (failureReason: string) =>
    `The runner answered "${failureReason}", which this version of the CLI does not know how to report. Upgrade with npm install -g @qawolf/cli.`,
  screenNeedsARun:
    "This runner has not run anything yet, so its screen has never started. Waiting will not clear this and there is nothing to retry: run a flow on it with qawolf runner run, then ask again. Evaluating a snippet does not start a screen.",
  screenNotReady:
    "The runner has a screen and cannot serve this yet. Its virtual desktop restarts when a run changes the display size, and it serves one request at a time, so something already in flight is the usual reason. Retry in a second or two.",
  screenshotNotAnImage:
    "The screen was captured but did not arrive as a JPEG, so nothing was written. Nothing about the command needs changing: try it again, and report it if it keeps happening.",
  screenshotUnwritable: (path: string, detail: string) =>
    `The screen was captured but could not be written to "${path}": ${detail}. Give --out a path this process can write to.`,
  screenshotWritten: (path: string) => `Wrote the runner's screen to ${path}.`,
  snippetEmpty: (path: string) => `"${path}" holds no code to evaluate.`,
  snippetErrored: (errorMessage: string | undefined) =>
    errorMessage === undefined
      ? "The snippet threw and reported no message."
      : `The snippet threw: ${errorMessage}`,
  snippetFileUnreadable: (path: string) =>
    `Could not read "${path}". Name a readable file, or "-" to read the snippet from stdin.`,
  snippetRan:
    "The snippet ran. Its value is not returned: read anything it printed with qawolf runner events console.",
  snippetStopped:
    "The snippet was interrupted before it finished. Anything it printed first is in qawolf runner events console.",
  stdinEmptyAction:
    'Nothing arrived on stdin. Pipe the action in, or name the action type instead of "-".',
  stdinEmptySnippet:
    'Nothing arrived on stdin. Pipe the snippet in, or name a file instead of "-".',
  missingPackageJsonForImport:
    "No package.json in the current directory. The install resolves against the run's own dependencies, which are read from one.",
  packageInstalled: (name: string, version: string) =>
    `Installed ${name}@${version} into the runner's live run.`,
  packageJsonUnreadable: (reason: string) =>
    `package.json could not be read because ${reason}. Fix it and try again.`,
  installFailed: (
    name: string,
    version: string,
    errorMessage: string | undefined,
  ) =>
    `npm could not install ${name}@${version}${errorMessage === undefined ? "" : `. ${errorMessage}`}. Check the name and the version; waiting will not change this.`,
  importAnsweredUnknown: (failureReason: string) =>
    `The runner answered "${failureReason}", which this version of the CLI does not know how to report. Upgrade with npm install -g @qawolf/cli.`,
  highlightCleared:
    "Cleared the runner's highlight. Its next screenshot shows the page undrawn on.",
  highlightMatched: (matchCount: number, targetPage: string | undefined) =>
    `Highlighted ${pluralize(matchCount, "element", "elements")}${targetPage === undefined ? "" : ` on ${targetPage}`}. The highlight stays until it is replaced or cleared, so take a screenshot to see it.`,
  highlightMatchedNothing: (selector: string) =>
    `The page read "${selector}" as a selector and nothing matched it, so nothing is highlighted. The selector is well formed, so this is the page rather than the syntax: check what is actually on it with qawolf runner inspect page-html.`,
  highlightSelectorInvalid: (selector: string) =>
    `The page could not read "${selector}" as a selector, so nothing was highlighted. This is the syntax rather than the page, and retrying will not change it.`,
  highlightNoAnswer:
    "The page did not answer, so nothing is highlighted. A highlight runs inside the page, so a page that is gone or part-way through navigating does not answer at all rather than answering slowly. Take a screenshot to see where the runner is, then try again.",
  runnerCannotHighlightSelectors:
    "This runner has no browser to draw on, so there is nothing to highlight. Retrying will never help: launch a playwright runner instead.",
  highlightAnsweredUnknown: (failureReason: string) =>
    `The runner answered "${failureReason}", which this version of the CLI does not know how to report. Upgrade with npm install -g @qawolf/cli.`,
  snapshotPromoted: (screenshotPath: string, baselinePath: string) =>
    `Promoted ${screenshotPath} to the baseline at ${baselinePath}.`,
  snapshotNotFound: (screenshotPath: string) =>
    `The run wrote no screenshot at "${screenshotPath}", so nothing was changed. The two paths have to be the ones an image diff reported: read them from the image-diff-artifact entry on qawolf runner events run-events.`,
  runnerCannotPromoteSnapshots:
    "This runner stores no screenshots, so it holds no baseline to replace. Retrying will never help.",
  promoteSnapshotAnsweredUnknown: (failureReason: string) =>
    `The runner answered "${failureReason}", which this version of the CLI does not know how to report. Upgrade with npm install -g @qawolf/cli.`,
} as const;
