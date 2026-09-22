export const recordingMessages = {
  unsupported: "Video recording requires a Playwright runner.",
  screenNotReady:
    "The runner's screen is not ready. Run a flow before starting a recording.",
  inProgress:
    "A recording is already in progress. Use runner record status to check its mode and id. Stop a manual recording by id, or wait for the run to finish an automatic recording.",
  notFound:
    "That recording was not found on the runner. Use runner record status for the active recording or runner recordings for published history.",
  idUsed:
    "That recording id has already been used. Start a new recording with a new UUID.",
  failed:
    "The recording operation failed. If this was a stop, retry it with the same recording id to finish stopping or publishing it. Check runner recordings for its published status.",
  failedCapture:
    "The recording failed. Check runner recordings for its published status.",
  recordingId: (id: string) => `Recording id: ${id}.`,
} as const;
