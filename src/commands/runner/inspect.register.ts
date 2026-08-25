import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerInspect } from "~/domains/interactiveRunner/inspect.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";
import { registerRunnerInspectMobileCommands } from "./inspectMobile.register.js";

const inspectExamples = `
Examples:
  $ qawolf runner inspect element-html --selector "#email"
  $ qawolf runner inspect page-html > page.html
  $ qawolf runner inspect variable --name cart | jq .total
  $ qawolf runner inspect session
  $ qawolf runner inspect contexts
  $ qawolf runner inspect page-source --context WEBVIEW_1
  $ qawolf runner inspect elements --by point --x 200 --y 400
  $ qawolf runner inspect elements --by text --text "Sign in" --partial`;

/**
 * A group rather than one command with a positional, because each arm needs
 * different flags. `element-html`/`page-html`/`variable` read a browser's
 * page; `session`/`contexts`/`page-source`/`elements` read a mobile runner's
 * Appium session instead — the two never apply to the same runner.
 */
export function registerRunnerInspectCommands(
  runner: Command,
  signals: SignalRegistry,
): void {
  const inspect = runner
    .command("inspect")
    .description(
      "Read one thing off a runner's live page (browser) or Appium session (mobile)",
    )
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

  registerRunnerInspectMobileCommands(inspect, signals);
}
