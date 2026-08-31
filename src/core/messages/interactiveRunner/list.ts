export const listMessages = {
  noRunners:
    "This directory has no runner running. Launch one with qawolf runner launch, or pass --runner to address a runner started elsewhere.",
  runnerCount: (count: number) =>
    count === 1 ? "1 runner" : `${String(count)} runners`,
  title: "Runners",
} as const;
