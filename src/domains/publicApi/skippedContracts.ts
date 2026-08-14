// Every name below is served by a hand-written command instead, and is listed
// so the generator does not mint a duplicate (flow.list is served by
// `qawolf flows list --remote`). That is the only reason to skip a contract: one
// whose input has no flag shape earns a place here once a hand-written command
// serves it, and until then stays out and lets the generator report what it
// cannot express.
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
/** Every contract the generator passes over. */
export const skippedContractNames: ReadonlySet<string> = new Set([
  "flow.list",
  "runner.evaluateSnippet",
  "runner.launch",
  "runner.performAction",
  "runner.readJournal",
  "runner.runFlow",
  "runner.stop",
  "runner.takeScreenshot",
]);
