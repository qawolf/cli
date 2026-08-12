// Which published contracts get no generated command, and why.

// Served by hand-written commands instead; the generator must not mint
// duplicates (flow.list is served by `qawolf flows list --remote`).
//
// The whole `runner.*` family is hand-written as `qawolf runner`. Three of its
// inputs carry a file list or an action union and have no flag shape at all, and
// the four that do need UX the generator cannot give them: an optional
// `--runner` resolved from flag, environment and stored default; a runner
// launched on demand and announced; a screenshot decoded into a file. Half the
// group generated beside the other half hand-written would read as two unrelated
// command sets sharing a prefix. The group is claimed as a whole here, so the
// contracts whose commands land in a later change are absent rather than
// generated in a shape the rest of the group does not match.
const handWrittenContractNames: ReadonlySet<string> = new Set([
  "flow.list",
  "runner.evaluateSnippet",
  "runner.launch",
  "runner.performAction",
  "runner.readJournal",
  "runner.runFlow",
  "runner.stop",
  "runner.takeScreenshot",
]);

// No flag shape and no command anywhere, kept apart from the set above so
// neither list claims what is only true of the other: these are absent from the
// CLI rather than served elsewhere. `issue.update` is a discriminator-less union,
// so no set of flags can say which arm a caller means.
const unexpressibleContractNames: ReadonlySet<string> = new Set([
  "issue.update",
]);

/** Every contract the generator passes over, for whichever of the two reasons. */
export const skippedContractNames: ReadonlySet<string> = new Set([
  ...handWrittenContractNames,
  ...unexpressibleContractNames,
]);
