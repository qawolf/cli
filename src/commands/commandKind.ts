import type { Command } from "commander";

// `read` calls the QA Wolf API without changing anything; `write` changes
// team state; `local` only affects this machine. Rendered in the qawolf-cli
// skill so agents know which commands are safe to run and retry.
export type CommandKind = "read" | "write" | "local";

export type DeclaredKind = {
  kind: CommandKind;
  // For commands whose kind depends on a flag, e.g. "read with --remote" on
  // a `local` command. Rendered next to the kind in the skill table.
  kindNote: string | undefined;
};

const kinds = new WeakMap<Command, DeclaredKind>();

// Declare the kind at the command's definition site. The skill renderer
// throws on visible commands without a declared kind, so a new command
// cannot ship unclassified.
export function declareCommandKind<DeclaredCommand extends Command>(
  command: DeclaredCommand,
  kind: CommandKind,
  options?: { kindNote: string },
): DeclaredCommand {
  kinds.set(command, { kind, kindNote: options?.kindNote });
  return command;
}

export function getCommandKind(command: Command): DeclaredKind | undefined {
  return kinds.get(command);
}
