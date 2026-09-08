export const listMessages = {
  noRunners:
    "Your team has no runner running. Launch one with qawolf runner launch.",
  runnerCount: (count: number) =>
    count === 1 ? "1 runner" : `${String(count)} runners`,
  title: "Runners",
} as const;
