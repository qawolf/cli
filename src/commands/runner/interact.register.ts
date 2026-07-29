import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerExec } from "~/domains/interactiveRunner/evaluateSnippet.js";
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
  $ qawolf runner screenshot --out screens/step-3.jpg`;

const actExamples = `
Examples:
  $ qawolf runner act click --button left --x 480 --y 260
  $ qawolf runner act type --text "hello@example.com"
  $ qawolf runner act keypress --keys Control a
  $ qawolf runner act navigate --url https://example.com
  $ qawolf runner act drag --path '[{"x":10,"y":20},{"x":80,"y":90}]'
  $ echo '{"type":"click","button":"left","x":1,"y":2}' | qawolf runner act -`;

const execExamples = `
Examples:
  $ qawolf runner exec snippet.ts
  $ echo 'console.log(await page.title())' | qawolf runner exec -
  $ qawolf runner exec snippet.ts --file flows/checkout.flow.ts`;

type ActFlags = {
  button?: string;
  keys?: string[];
  path?: string;
  runner?: string;
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
    .description("Save a JPEG of an interactive runner's screen to a file")
    .option("--out <path>", "File to write the image to", defaultScreenshotPath)
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
      "Perform one raw action on a runner's screen: click, double_click, scroll, move, drag, keypress, navigate or type. Use - to read a whole action as JSON from stdin",
    )
    .option("--button <button>", "click: left, right, wheel, back or forward")
    .option(
      "--keys <keys...>",
      "keypress: modifiers and the key, e.g. Control a",
    )
    .option("--path <json>", "drag: JSON array of points to drag through")
    .option("--runner <id>", runnerFlagDescription)
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
            type: action,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

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
