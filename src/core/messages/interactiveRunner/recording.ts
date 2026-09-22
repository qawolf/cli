export const recordingMessages = {
  unsupported: "Video recording requires a Playwright runner.",
  screenNotReady:
    "The runner's screen is not ready. Run a flow before starting a recording.",
  inProgress:
    "A recording is already in progress. Use runner record status to get its id, then stop that recording first.",
  notFound:
    "That recording was not found on the runner. Use runner record status for the active recording or runner recordings for published history.",
  idUsed:
    "That recording id has already been used. Start a new recording with a new UUID.",
  failed:
    "The recording failed. Check runner recordings for its published status.",
  recordingId: (id: string) => `Recording id: ${id}.`,
} as const;
