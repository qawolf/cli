import { type Command, Help } from "commander";

export function listVisibleSubcommands(command: Command): Command[] {
  return new Help()
    .visibleCommands(command)
    .filter((child) => child.name() !== "help");
}

export function commandPath(command: Command): string[] {
  return command.parent === null
    ? [command.name()]
    : [...commandPath(command.parent), command.name()];
}

export function findSubcommand(
  root: Command,
  path: readonly string[],
): Command | undefined {
  return path.reduce<Command | undefined>(
    (command, segment) =>
      command?.commands.find(
        (child) =>
          child.name() === segment || child.aliases().includes(segment),
      ),
    root,
  );
}
