import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerExec } from "~/domains/interactiveRunner/evaluateSnippet.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const execExamples = `
Examples:
  $ qawolf runner exec snippet.ts
  $ echo 'console.log(await page.title())' | qawolf runner exec -
  $ qawolf runner exec snippet.ts --file flows/checkout.flow.ts`;

export function registerRunnerExecCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("exec <file>"), "write")
    .description(
      "Evaluate a snippet against a runner's live page. Use - to read the snippet from stdin",
    )
    .option(
      "--file <path>",
      "File whose scope the snippet is evaluated in; it and the directory's other files travel with it",
    )
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", execExamples)
    .action(
      (
        file: string,
        opts: { file?: string; runner?: string },
        command: Command,
      ) =>
        withAuthContext(signals, (ctx) =>
          handleRunnerExec(
            ctx,
            { contextFile: opts.file, runner: opts.runner, source: file },
            runnerDeps(ctx),
          ),
        )(opts, command),
    );
}
