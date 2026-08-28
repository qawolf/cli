import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerPromoteSnapshot } from "~/domains/interactiveRunner/promoteSnapshot.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const promoteSnapshotExamples = `
Examples:
  $ qawolf runner promote-snapshot --screenshot checkout-1-actual.png --baseline checkout-1.png
  $ qawolf runner events run-events --tail 20 | jq 'select(.type == "image-diff-artifact")'`;

export function registerRunnerPromoteSnapshotCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  // Both paths are named rather than positional: two paths with one unlabelled
  // is easy to get backwards, and swapping them promotes the wrong image.
  declareCommandKind(runner.command("promote-snapshot"), "write")
    .description(
      "Accept a run's screenshot as the new baseline for an image diff, on the runner that produced it",
    )
    .requiredOption(
      "--screenshot <path>",
      "The screenshot to promote, as the image diff named it",
    )
    .requiredOption(
      "--baseline <path>",
      "The baseline to replace, as the image diff named it",
    )
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", promoteSnapshotExamples)
    .action(
      (
        opts: { baseline: string; runner?: string; screenshot: string },
        command: Command,
      ) =>
        withAuthContext(signals, (ctx) =>
          handleRunnerPromoteSnapshot(
            ctx,
            {
              baselinePath: opts.baseline,
              runner: opts.runner,
              screenshotPath: opts.screenshot,
            },
            runnerDeps(ctx),
          ),
        )(opts, command),
    );
}
