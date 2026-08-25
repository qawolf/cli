import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerInspectMobile } from "~/domains/interactiveRunner/inspectMobile.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

type InspectElementsFlags = {
  by: string;
  context?: string;
  partial?: boolean;
  runner?: string;
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
              by: undefined,
              context: undefined,
              partial: undefined,
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
              by: undefined,
              context: undefined,
              partial: undefined,
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
              by: undefined,
              context: opts.context,
              partial: undefined,
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
      "Find elements at a screen point, or elements carrying some text",
    )
    .requiredOption("--by <by>", "point or text")
    .option("--context <name>", "Read this context instead of the current one")
    .option(
      "--partial",
      "text: match text containing this, rather than exactly this",
    )
    .option("--runner <id>", runnerFlagDescription)
    .option("--text <text>", "text: the text to match")
    .option("--x <pixels>", "point: whole pixels on the device's own screen")
    .option("--y <pixels>", "point: whole pixels on the device's own screen")
    .action((opts: InspectElementsFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerInspectMobile(
          ctx,
          {
            flags: {
              by: opts.by,
              context: opts.context,
              partial: opts.partial,
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
