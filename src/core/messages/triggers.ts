type PausedWrite = { baseUrl: string; command: string };

const notSupported = ({ baseUrl, command }: PausedWrite) =>
  `QA Wolf at ${baseUrl} does not support --is-paused on qawolf ${command} yet, so it ignored the flag.`;

const pauseItNow = (triggerId: string, url: string | undefined) =>
  `Pause it now with qawolf trigger pause --trigger-id ${triggerId}${url ? `, or from its page: ${url}` : ""}.`;

export const triggerMessages = {
  pausedAfterwards: (write: PausedWrite & { triggerId: string }) => ({
    error: `${notSupported(write)} Trigger ${write.triggerId} was left running, so the CLI paused it with qawolf trigger pause.`,
    errorBody: `It stays paused. Check it, then turn it on with qawolf trigger resume --trigger-id ${write.triggerId}.`,
  }),
  leftLive: (
    write: PausedWrite & {
      reason: string;
      triggerId: string;
      url: string | undefined;
    },
  ) => ({
    error: `Trigger ${write.triggerId} is live and will fire. ${notSupported(write)} Pausing it afterwards failed: ${write.reason}`,
    errorBody: pauseItNow(write.triggerId, write.url),
  }),
} as const;
