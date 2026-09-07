import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerAct } from "~/domains/interactiveRunner/performAction.js";
import { handleRunnerScreenshot } from "~/domains/interactiveRunner/takeScreenshot.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

// JPEG, because that is what the API answers with; a .png name would be a lie
// about the bytes in the file.
const defaultScreenshotPath = "screenshot.jpg";

const screenshotExamples = `
Examples:
  $ qawolf runner screenshot
  $ qawolf runner screenshot --out screens/step-3.jpg
  $ qawolf runner screenshot --out - > step-3.jpg
  $ qawolf runner screenshot --out - | my-vision-tool`;

const actExamples = `
Examples:
  $ qawolf runner act click --button left --x 480 --y 260
  $ qawolf runner act type --text "hello@example.com"
  $ qawolf runner act keypress --keys Control a
  $ qawolf runner act navigate --url https://example.com
  $ qawolf runner act drag --path '[{"x":10,"y":20},{"x":80,"y":90}]'
  $ qawolf runner act click --button left --x 480 --y 260 --screenshot step-4.jpg
  $ echo '{"type":"click","button":"left","x":1,"y":2}' | qawolf runner act -
  $ echo '{"type":"click","button":"left","x":1,"y":2}' | qawolf runner act - --screenshot - > step-5.jpg`;

type ActFlags = {
  button?: string;
  keys?: string[];
  path?: string;
  runner?: string;
  screenshot?: string;
  scrollX?: string;
  scrollY?: string;
  text?: string;
  url?: string;
  x?: string;
  y?: string;
};

export function registerRunnerInteractCommands(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("screenshot"), "read")
    .description(
      "Save a JPEG of an interactive runner's screen to a file, or write it to stdout with --out -",
    )
    .option(
      "--out <path>",
      "File to write the image to. - writes the JPEG bytes to stdout on their own and moves the confirmation, JSON included, to stderr",
      defaultScreenshotPath,
    )
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", screenshotExamples)
    .action((opts: { out: string; runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerScreenshot(
          ctx,
          { out: opts.out, runner: opts.runner },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  // The action names are the computer-use vocabulary a vision model emits, so a
  // caller forwards its model's tool call rather than translating it.
  declareCommandKind(runner.command("act <action>"), "write")
    .description(
      "Perform one raw action on a runner's screen: click, double_click, scroll, move, drag, keypress, navigate or type. Use - to read a whole action as JSON from stdin. On a mobile runner only click (button left), drag and type have a touchscreen equivalent; the rest answer action-not-supported-on-mobile",
    )
    .option(
      "--button <button>",
      "click: left, right, wheel, back or forward (mobile: left only)",
    )
    .option(
      "--keys <keys...>",
      "keypress: modifiers and the key, e.g. Control a",
    )
    .option(
      "--path <json>",
      "drag: JSON array of points to drag through (mobile: only the first and last are used)",
    )
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--screenshot <path>",
      "Also save a JPEG of the screen, taken after the action, to this file, in place of a separate screenshot. - writes it to stdout and moves the confirmation, JSON included, to stderr",
    )
    .option("--scroll-x <delta>", "scroll: horizontal wheel delta")
    .option("--scroll-y <delta>", "scroll: vertical wheel delta")
    .option("--text <text>", "type: the text to type")
    .option("--url <url>", "navigate: the http or https URL to go to")
    .option("--x <pixels>", "pointer x, in screenshot pixels")
    .option("--y <pixels>", "pointer y, in screenshot pixels")
    .addHelpText("after", actExamples)
    .action((action: string, opts: ActFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerAct(
          ctx,
          {
            flags: {
              button: opts.button,
              keys: opts.keys,
              path: opts.path,
              scrollX: opts.scrollX,
              scrollY: opts.scrollY,
              text: opts.text,
              url: opts.url,
              x: opts.x,
              y: opts.y,
            },
            runner: opts.runner,
            screenshot: opts.screenshot,
            type: action,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
