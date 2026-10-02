import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { handleRunnerAct } from "~/domains/interactiveRunner/performAction.js";
import { handleRunnerScreenshot } from "~/domains/interactiveRunner/takeScreenshot.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { actExamples } from "./actExamples.js";
import {
  runnerDeps,
  runnerFlagDescription,
  withRunnerContext,
} from "./context.js";

// JPEG, because that is what the API answers with; a .png name would be a lie
// about the bytes in the file.
const defaultScreenshotPath = "screenshot.jpg";

const screenshotExamples = `
Examples:
  $ qawolf runner screenshot
  $ qawolf runner screenshot --out screens/step-3.jpg
  $ qawolf runner screenshot --out - > step-3.jpg
  $ qawolf runner screenshot --out - | my-vision-tool`;

type ActFlags = {
  button?: string;
  durationMs?: string;
  from?: string;
  keys?: string[];
  path?: string;
  runner?: string;
  screenshot?: string;
  scrollX?: string;
  scrollY?: string;
  selector?: string;
  strategy?: string;
  text?: string;
  to?: string;
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
      withRunnerContext(signals, (ctx) =>
        handleRunnerScreenshot(
          ctx,
          { out: opts.out, runner: opts.runner },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  // The browser action names are the computer-use vocabulary a vision model
  // emits, so a caller forwards its model's tool call rather than translating it.
  declareCommandKind(runner.command("act <action>"), "write")
    .description(
      "Perform one raw action on a runner's screen. A browser runner takes click, double_click, scroll, move, drag, keypress, navigate and type; a mobile runner takes tap, swipe, fill and type. A browser runner answers mobile actions with action-not-supported-on-browser; a mobile runner answers the other browser actions with action-not-supported-on-mobile. Use - to read a whole action as JSON from stdin",
    )
    .option("--button <button>", "click: left, right, wheel, back or forward")
    .option(
      "--duration-ms <ms>",
      "swipe: how long it takes, up to 10000. Slow scrolls, fast flings",
    )
    .option("--from <x,y>", "swipe: the point it starts at")
    .option(
      "--keys <keys...>",
      "keypress: modifiers and the key, e.g. Control a",
    )
    .option("--path <json>", "drag: JSON array of points to drag through")
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--screenshot <path>",
      "Also save a JPEG of the screen, taken after the action, to this file, in place of a separate screenshot. An action that did not take effect answers with one too. - writes it to stdout and moves the confirmation, JSON included, to stderr",
    )
    .option("--scroll-x <delta>", "scroll: horizontal wheel delta")
    .option("--scroll-y <delta>", "scroll: vertical wheel delta")
    .option(
      "--selector <selector>",
      "tap or fill: the element to act on, as a screen object would find it. tap takes it in place of --x and --y",
    )
    .option(
      "--strategy <strategy>",
      "how --selector is resolved: xpath (default), ios-predicate or shadow",
    )
    .option(
      "--text <text>",
      "type: the text to type into what has focus. fill: the field's new value",
    )
    .option("--to <x,y>", "swipe: the point it ends at")
    .option("--url <url>", "navigate: the http or https URL to go to")
    .option("--x <pixels>", "click, tap and the like: x, in screenshot pixels")
    .option("--y <pixels>", "click, tap and the like: y, in screenshot pixels")
    .addHelpText("after", actExamples)
    .action((action: string, opts: ActFlags, command: Command) =>
      withRunnerContext(signals, (ctx) =>
        handleRunnerAct(
          ctx,
          {
            flags: {
              button: opts.button,
              durationMs: opts.durationMs,
              from: opts.from,
              keys: opts.keys,
              path: opts.path,
              scrollX: opts.scrollX,
              scrollY: opts.scrollY,
              selector: opts.selector,
              strategy: opts.strategy,
              text: opts.text,
              to: opts.to,
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
