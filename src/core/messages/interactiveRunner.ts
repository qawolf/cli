import { formatSeconds } from "~/core/formatSeconds.js";
import { pluralize } from "~/core/pluralize.js";

export const interactiveRunnerMessages = {
  alreadyRunning: (id: string) => `Runner ${id} was already running.`,
  actionFailed: (errorMessage: string) =>
    `The action reached the runner and did not take effect: ${errorMessage}`,
  actionMayHaveHappened:
    "The runner could not be reached, which does not mean the action was not performed: it may have stopped answering mid-action. Take a screenshot before repeating it.",
  actionPerformed: (type: string) => `Performed ${type}.`,
  defaultNotRemembered: (id: string) =>
    `Runner ${id} could not be written to .qawolf as this directory's default, so later commands will not find it on their own. Pass --runner ${id}, or set QAWOLF_RUNNER_ID=${id}.`,
  defaultNotForgotten: (id: string) =>
    `Runner ${id} was stopped, but it could not be removed from .qawolf as this directory's default, so later commands will still be sent to it. Pass --runner, or launch a new runner.`,
  fileNotCollected: (path: string) =>
    `"${path}" is not one of the files that travel to a runner. It must be inside the current directory and end in .ts, .tsx, .js, .mjs, .cjs or .json.`,
  fileUnreadable: (path: string, reason: string) =>
    `${path} is one of the files that travel to a runner, but it could not be read: ${reason}. Move it out of the current directory, or make it readable.`,
  filesUnreadable: (reason: string) =>
    `One of the files that travel to a runner could not be read: ${reason}.`,
  filesTooLarge: (
    byteLength: number,
    maxByteLength: number,
    largest: readonly { byteLength: number; path: string }[],
  ) =>
    `The collected files carry ${String(byteLength)} bytes, over the ${String(maxByteLength)} a single run may ship. The largest are ${largest
      .map((file) => `${file.path} (${String(file.byteLength)} bytes)`)
      .join(
        ", ",
      )}. Every .ts, .tsx, .js, .mjs, .cjs and .json file under the current directory travels, build output included, so run from a directory holding only the flow and what it imports.`,
  keptAlive: (id: string) =>
    `Runner ${id} is alive, and its inactivity clock has been reset.`,
  launchFailed: (id: string, error: string) =>
    `Launching runner ${id} failed. ${error}`,
  launchLost: (id: string, error: string) =>
    `Launching runner ${id} failed. ${error}. The request may still have reached QA Wolf and started a runner, so relaunch the same id with qawolf runner launch --id ${id} to attach to it rather than start a second one, or stop it with qawolf runner stop --runner ${id}.`,
  launched: (id: string) => `Launched runner ${id}.`,
  launchedForCommand: (id: string) =>
    `No runner was given, so launched ${id} for this command. Its browser is fresh: nothing has been run on it and nothing is signed in. It bills until it is stopped or idles out, so stop it with qawolf runner stop --runner ${id} when you are done.`,
  followEventsTimedOut: (stream: string, seconds: number) =>
    `Stopped following ${stream} after ${formatSeconds(seconds * 1000)}: reading keeps the runner alive and billing, so a follow does not run unbounded. Pass --timeout to wait longer, or follow again to continue.`,
  followTimedOut: (runId: string, runnerId: string, seconds: number) =>
    `Stopped following run ${runId} after ${formatSeconds(seconds * 1000)}. The run may still be going: read it with qawolf runner events run-status --run ${runId}, and stop the runner with qawolf runner stop --runner ${runnerId} when you are done. Pass --timeout to wait longer.`,
  missingPackageJson:
    "No package.json in the current directory. A run reads its npm dependencies from one, so it has to travel with the flow.",
  noRunnerId:
    "No runner id. Pass --runner, set QAWOLF_RUNNER_ID, or run qawolf runner launch first.",
  notRunning: (id: string) => `Runner ${id} was not running.`,
  runFailed: (errorMessage: string | undefined) =>
    errorMessage === undefined
      ? "The run failed and reported no reason."
      : `The run failed: ${errorMessage}`,
  runPassed: "The run passed.",
  runSettledUnknown: (status: string) =>
    `The run settled as "${status}", which this version of the CLI does not recognize. Upgrade to read it.`,
  runSubmitAnsweredUnknown: (outcome: string) =>
    `The runner answered the submission with "${outcome}", which this version of the CLI does not recognize. Upgrade to read it.`,
  runSubmitted: (runId: string) => `Submitted run ${runId}.`,
  runnerHasNoScreen:
    "This runner does not run a browser on a virtual desktop, so there is nothing about it to see or drive. Retrying will never help: launch a node20WithPlaywright runner instead.",
  runnerHasNoScreenToEvaluate:
    "The runner could not evaluate the snippet. As well as a runner that is still starting or busy, this covers one with no live page to evaluate against, which will never clear: check that the runner you launched runs a browser.",
  screenNotReady:
    "The runner has a screen and cannot serve this yet. Its virtual desktop starts with the runner's first run, it restarts when a run changes the display size, and it serves one request at a time. Retry in a second or two, or run something on the runner if it has not run anything yet.",
  screenshotWritten: (path: string) => `Wrote the runner's screen to ${path}.`,
  snippetErrored: (errorMessage: string | undefined) =>
    errorMessage === undefined
      ? "The snippet threw and reported no message."
      : `The snippet threw: ${errorMessage}`,
  snippetEmpty: (path: string) => `"${path}" holds no code to evaluate.`,
  snippetFileUnreadable: (path: string) =>
    `Could not read "${path}". Name a readable file, or "-" to read the snippet from stdin.`,
  snippetRan:
    "The snippet ran. Its value is not returned: read anything it printed with qawolf runner events console.",
  snippetStopped:
    "The snippet was interrupted before it finished. Anything it printed first is in qawolf runner events console.",
  stdinEmpty: (what: string) =>
    `Nothing arrived on stdin. Pipe the ${what} in, or name a file instead of "-".`,
  runnerUnreachable:
    "The runner could not be reached. It may still be starting, or it may have terminated after inactivity. Retry, or launch it again.",
  skippedEntries: (stream: string, count: number) =>
    `${pluralize(count, "entry", "entries")} of ${stream} were dropped before this read: the runner keeps a bounded history and this follow has been overtaken.`,
  stopped: (id: string) => `Stopped runner ${id}.`,
  requestTooLarge: (byteLength: number, maxByteLength: number) =>
    `The run request encodes to ${String(byteLength)} bytes, over the ${String(maxByteLength)} a runner accepts. Escaping inflates file content, so a set of files inside the content cap can still encode to more than this. Run from a directory holding only the flow and what it imports.`,
  unknownStream: (stream: string, known: readonly string[]) =>
    `"${stream}" is not a stream QA Wolf writes, so this read has nothing to return. QA Wolf writes ${known.join(", ")}.`,
  unsearchedHistory: (stream: string) =>
    `This read of ${stream} stopped before searching all of the runner's history, so older entries may exist that it did not look at. Page forwards with --since to reach them.`,
  submitMayHaveStarted:
    "The runner did not answer, which does not mean the run did not start. Read qawolf runner events run-status before running the flow again, and use the newest run id there if one appeared.",
  targetMismatch: (runnerName: string, requiredRunnerName: string) =>
    `This flow needs a ${requiredRunnerName} runner and ${runnerName} is running. Launch one with --name ${requiredRunnerName}.`,
} as const;
