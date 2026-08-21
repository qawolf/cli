import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerInspect } from "~/domains/interactiveRunner/inspect.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const inspectExamples = `
Examples:
  $ qawolf runner inspect element-html --selector "#email"
  $ qawolf runner inspect page-html > page.html
  $ qawolf runner inspect variable --name cart | jq .total`;

/**
 * A group rather than one command with a positional, because each of the three
 * needs different flags and only `page-html` can be asked without one.
 */
export function registerRunnerInspectCommands(
  runner: Command,
  signals: SignalRegistry,
): void {
  const inspect = runner
    .command("inspect")
    .description("Read one thing off a runner's live page")
    .addHelpText("after", inspectExamples);

  declareCommandKind(inspect.command("element-html"), "read")
    .description("Print the HTML of the first element a selector matches")
    .requiredOption("--selector <selector>", "Playwright selector to inspect")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string; selector: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspect(
          ctx,
          {
            flags: { name: undefined, selector: opts.selector },
            runner: opts.runner,
            what: "element-html",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(inspect.command("page-html"), "read")
    .description("Print the page's HTML, simplified for a model to read")
    .option("--selector <selector>", "Limit the output to this subtree")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string; selector?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspect(
          ctx,
          {
            flags: { name: undefined, selector: opts.selector },
            runner: opts.runner,
            what: "page-html",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(inspect.command("variable"), "read")
    .description("Print a top-level variable's value from the running workflow")
    .requiredOption("--name <name>", "Name of the variable to read")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { name: string; runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspect(
          ctx,
          {
            flags: { name: opts.name, selector: undefined },
            runner: opts.runner,
            what: "variable",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
