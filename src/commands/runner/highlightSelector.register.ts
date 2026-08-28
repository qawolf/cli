import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerHighlightSelector } from "~/domains/interactiveRunner/highlightSelector.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const highlightExamples = `
Examples:
  $ qawolf runner highlight-selector "text=Sign in"
  $ qawolf runner highlight-selector "#checkout" && qawolf runner screenshot
  $ qawolf runner highlight-selector`;

export function registerRunnerHighlightSelectorCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("highlight-selector [selector]"), "write")
    .description(
      "Highlight what a selector matches on a runner's live page, so the next screenshot shows it. Omit the selector to clear the highlight",
    )
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", highlightExamples)
    .action(
      (
        selector: string | undefined,
        opts: { runner?: string },
        command: Command,
      ) =>
        withAuthContext(signals, (ctx) =>
          handleRunnerHighlightSelector(
            ctx,
            { runner: opts.runner, selector },
            runnerDeps(ctx),
          ),
        )(opts, command),
    );
}
