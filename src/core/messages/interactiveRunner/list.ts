export const listMessages = {
  noRunners:
    "Your team has no runner running. Launch one with qawolf runner launch.",
  noRunnersHere:
    "This directory has no runner running. Launch one with qawolf runner launch, or drop --here to see the whole team's runners.",
  runnerCount: (count: number) =>
    count === 1 ? "1 runner" : `${String(count)} runners`,
  title: "Runners",
} as const;
