import { type Command, Option } from "commander";
import { type ScreenshotMode, screenshotModes } from "@qawolf/api-contracts/v1";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerActions } from "~/domains/interactiveRunner/performActions.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const actionsExamples = `
Examples:
  $ qawolf runner actions '[{"type":"click","button":"left","x":480,"y":260},{"type":"type","text":"hello@example.com"},{"type":"keypress","keys":["Enter"]}]' --screenshot after-login.jpg
  $ echo '[{"type":"click","button":"left","x":1,"y":2},{"type":"type","text":"hi"}]' | qawolf runner actions -
  $ qawolf runner actions '[...]' --screenshot-mode each --screenshot step.jpg
  $ qawolf runner actions '[...]' --continue-on-failure`;

type ActionsFlags = {
  continueOnFailure?: boolean;
  runner?: string;
  screenshot?: string;
  screenshotMode?: ScreenshotMode;
};

export function registerRunnerActionsCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  // One request for the steps a caller already knows, in place of one per step.
  // The frames come back as files, never inline: a sequence's worth of base64
  // is not something a terminal or a JSON reader wants.
  declareCommandKind(runner.command("actions <sequence>"), "write")
    .description(
      "Perform a sequence of up to ten raw actions on a runner's screen in one request, as a JSON array of the same actions `runner act` takes. Use - to read the array from stdin. Actions run back to back, so batch only steps whose targets are on the screen you last saw, and end the sequence at the step that changes the page. Each result carries an effect: performed, not-performed, or unknown when the runner stopped answering and the action may have landed",
    )
    .option(
      "--continue-on-failure",
      "Carry on past an action that reached the runner and did not take effect; a runner that cannot be reached or a screen that cannot serve still ends the sequence",
    )
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--screenshot <path>",
      "Save a JPEG of the screen after the last action to this file. With --screenshot-mode each, one file per action, with the action's index before the extension. - writes the final frame to stdout and moves the confirmation to stderr",
    )
    .addOption(
      new Option(
        "--screenshot-mode <mode>",
        "Defaults to final when --screenshot is given, none otherwise",
      ).choices([...screenshotModes]),
    )
    .addHelpText("after", actionsExamples)
    .action((sequence: string, opts: ActionsFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerActions(
          ctx,
          {
            actions: sequence,
            continueOnFailure: opts.continueOnFailure === true,
            runner: opts.runner,
            screenshot: opts.screenshot,
            screenshotMode: opts.screenshotMode,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
