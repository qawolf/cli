export const interactiveRunnerMessages = {
  alreadyRunning: (id: string) => `Runner ${id} was already running.`,
  entryPointNotCollected: (path: string) =>
    `"${path}" is not one of the files that travel to a runner. It must be inside the current directory and end in .ts, .tsx, .js, .mjs, .cjs or .json.`,
  filesTooLarge: (byteLength: number, maxByteLength: number) =>
    `The collected files carry ${String(byteLength)} bytes, over the ${String(maxByteLength)} a single run may ship. Run from a directory holding only the flow and what it imports.`,
  launched: (id: string) => `Launched runner ${id}.`,
  launchedForCommand: (id: string) =>
    `No runner was given, so launched ${id} for this command. Its browser is fresh: nothing has been run on it and nothing is signed in.`,
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
    `The run settled as "${status}", which this version of the CLI does not recognise. Upgrade to read it.`,
  runSubmitted: (runId: string) => `Submitted run ${runId}.`,
  runnerUnreachable:
    "The runner could not be reached. It may still be starting, or it may have terminated after inactivity. Retry, or launch it again.",
  stopped: (id: string) => `Stopped runner ${id}.`,
  submitMayHaveStarted:
    "The runner did not answer, which does not mean the run did not start. Read qawolf runner events run-status before running the flow again, and use the newest run id there if one appeared.",
  targetMismatch: (runnerName: string, requiredRunnerName: string) =>
    `This flow needs a ${requiredRunnerName} runner and ${runnerName} is running. Launch one with --name ${requiredRunnerName}.`,
} as const;
