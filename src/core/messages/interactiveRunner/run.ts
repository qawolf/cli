import { formatSeconds } from "~/core/formatSeconds.js";
import { pluralize } from "~/core/pluralize.js";

export const runMessages = {
  envFileUnparseable: (reason: string) =>
    `The --env-file could not be read. ${reason}`,
  envFileUnreadable: (path: string) =>
    `No env file at ${path}. Pass a path that exists, or drop --env-file to send no environment.`,
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
  followEventsTimedOut: (stream: string, seconds: number) =>
    `Stopped following ${stream} after ${formatSeconds(seconds * 1000)}: reading keeps the runner alive and billing, so a follow does not run unbounded. Pass --timeout to wait longer, or follow again to continue.`,
  followEndCutShort:
    "The run settled, but the last window of its followed streams could not be read, so the output above may be missing its final lines.",
  followTimedOut: (runId: string, runnerId: string, seconds: number) =>
    `Stopped following run ${runId} after ${formatSeconds(seconds * 1000)}. The run may still be going: read it with qawolf runner events run-status --run ${runId}, and terminate the runner with qawolf runner terminate --runner ${runnerId} when you are done. Pass --timeout to wait longer.`,
  needsFullSync: (missingPaths: readonly string[]) =>
    `The runner does not hold ${missingPaths.join(", ")}, so it refused a run that referenced them without sending them. Run the flow again to ship every file it needs.`,
  missingPackageJson:
    "No package.json in the current directory. A run reads its npm dependencies from one, so it has to travel with the flow.",
  malformedLineRange: (lines: string) =>
    `"${lines}" is not a line range. Pass --lines as two 1-indexed line numbers joined by a dash, e.g. --lines 12-40.`,
  linesFileWithoutLines:
    "--lines-file names where a line range lives, so it only means something with --lines. Pass --lines, or drop --lines-file to run the whole flow.",
  bootstrappedForSelection:
    "This runner had no browser, so one was started before your lines ran. They ran against a fresh page, not the one an earlier run left: nothing is signed in and nothing was set up.",
  runFailed: (errorMessage: string | undefined) =>
    errorMessage === undefined
      ? "The run failed and reported no reason."
      : `The run failed: ${errorMessage}`,
  runInProgress: "The run is in progress.",
  runPassed: "The run passed.",
  runSettledUnknown: (status: string) =>
    `The run settled as "${status}", which this version of the CLI does not recognize. Upgrade to read it.`,
  runSubmitAnsweredUnknown: (outcome: string) =>
    `The runner answered the submission with "${outcome}", which this version of the CLI does not recognize. Upgrade to read it.`,
  runSubmitted: (runId: string) => `Submitted run ${runId}.`,
  requestTooLarge: (byteLength: number, maxByteLength: number) =>
    `The run request encodes to ${String(byteLength)} bytes, over the ${String(maxByteLength)} a runner accepts. Escaping inflates file content, so a set of files inside the content cap can still encode to more than this. Run from a directory holding only the flow and what it imports.`,
  skippedEntries: (stream: string, count: number) =>
    `${pluralize(count, "entry", "entries")} of ${stream} were dropped before this read: the runner keeps a bounded history and this follow has been overtaken.`,
  unknownStream: (stream: string, known: readonly string[]) =>
    `"${stream}" is not a stream QA Wolf writes, so this read has nothing to return. QA Wolf writes ${known.join(", ")}.`,
  unsearchedHistory: (stream: string) =>
    `This read of ${stream} stopped before searching all of the runner's history, so older entries may exist that it did not look at. Page forwards with --since to reach them.`,
  submitMayHaveStarted:
    "The runner did not answer, which does not mean the run did not start. Read qawolf runner events run-status before running the flow again, and use the newest run id there if one appeared.",
  targetMismatch: (runnerName: string, requiredRunnerName: string) =>
    `This flow needs a ${requiredRunnerName} runner and ${runnerName} is running. Launch one with --name ${requiredRunnerName}.`,
} as const;
