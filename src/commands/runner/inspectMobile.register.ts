import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerInspectMobile } from "~/domains/interactiveRunner/inspectMobile.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

type InspectElementsFlags = {
  context?: string;
  partial?: boolean;
  runner?: string;
  selector?: string;
  strategy?: string;
  text?: string;
  x?: string;
  y?: string;
};

/** The mobile arms of `qawolf runner inspect`; see `inspect.register.ts`. */
export function registerRunnerInspectMobileCommands(
  inspect: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(inspect.command("session"), "read")
    .description("Print the Appium session's status: ready, or why not")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspectMobile(
          ctx,
          {
            flags: {
              context: undefined,
              partial: undefined,
              selector: undefined,
              strategy: undefined,
              text: undefined,
              x: undefined,
              y: undefined,
            },
            runner: opts.runner,
            what: "session",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(inspect.command("contexts"), "read")
    .description("List the WebView contexts available, and which is current")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspectMobile(
          ctx,
          {
            flags: {
              context: undefined,
              partial: undefined,
              selector: undefined,
              strategy: undefined,
              text: undefined,
              x: undefined,
              y: undefined,
            },
            runner: opts.runner,
            what: "contexts",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(inspect.command("page-source"), "read")
    .description("Print the current context's page source, as a tree")
    .option("--context <name>", "Read this context instead of the current one")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { context?: string; runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspectMobile(
          ctx,
          {
            flags: {
              context: opts.context,
              partial: undefined,
              selector: undefined,
              strategy: undefined,
              text: undefined,
              x: undefined,
              y: undefined,
            },
            runner: opts.runner,
            what: "page",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(inspect.command("elements"), "read")
    .description(
      "Find elements at a screen point, carrying some text, or matching a selector",
    )
    .option("--context <name>", "Read this context instead of the current one")
    .option(
      "--partial",
      "text: match text containing this, rather than exactly this",
    )
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--selector <selector>",
      "Resolved the same way a screen object's own selector is",
    )
    .option(
      "--strategy <strategy>",
      "selector: xpath, ios-predicate, or shadow (defaults to xpath)",
    )
    .option("--text <text>", "text: the text to match")
    .option("--x <pixels>", "point: whole pixels on the device's own screen")
    .option("--y <pixels>", "point: whole pixels on the device's own screen")
    .action((opts: InspectElementsFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspectMobile(
          ctx,
          {
            flags: {
              context: opts.context,
              partial: opts.partial,
              selector: opts.selector,
              strategy: opts.strategy,
              text: opts.text,
              x: opts.x,
              y: opts.y,
            },
            runner: opts.runner,
            what: "elements",
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
