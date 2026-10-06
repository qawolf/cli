import type { Command } from "commander";

import { exitCodes } from "~/shell/exit.js";

import { commandPath, findSubcommand } from "./commandTree.js";
import { renderHelpReference } from "./reference.js";

const referenceExamples = `
Examples:
  $ qawolf help ref runner
  $ qawolf help ref runner inspect
  $ qawolf help reference`;

function resolveCommand(program: Command, path: readonly string[]): Command {
  const command = findSubcommand(program, path);
  if (command === undefined) {
    program.error(`error: unknown command '${path.join(" ")}'`, {
      code: "commander.unknownCommand",
      exitCode: exitCodes.invalidArgs,
    });
  }
  return command;
}

// Replaces Commander's built-in `help [command]`, which cannot take a
// subcommand of its own, so that `help ref` can sit next to it.
export function registerHelpCommand(program: Command): void {
  const help = program
    .helpCommand(false)
    .command("help")
    .description("Display help for a command")
    .usage("[command...]")
    .argument("[command...]", "Command to show help for")
    .action((path: string[]) => {
      resolveCommand(program, path).outputHelp();
    });

  help
    .command("ref")
    .alias("reference")
    .description(
      "Print the full help of a command and of every command under it, as Markdown. Omit the command for the whole CLI",
    )
    .argument("[command...]", "Command whose subtree to print")
    .addHelpText("after", referenceExamples)
    .action((path: string[]) => {
      const command = resolveCommand(program, path);
      program
        .configureOutput()
        .writeOut?.(renderHelpReference(command, commandPath(command)));
    });
}
