import type { Command } from "commander";

// `read` calls the QA Wolf API without changing anything; `write` changes
// team state; `local` only affects this machine. Rendered in the qawolf-cli
// skill so agents know which commands are safe to run and retry.
export type CommandKind = "read" | "write" | "local";

const kinds = new WeakMap<Command, CommandKind>();

// Declare the kind at the command's definition site. The skill renderer
// throws on visible commands without a declared kind, so a new command
// cannot ship unclassified.
export function declareCommandKind<DeclaredCommand extends Command>(
  command: DeclaredCommand,
  kind: CommandKind,
): DeclaredCommand {
  kinds.set(command, kind);
  return command;
}

export function getCommandKind(command: Command): CommandKind | undefined {
  return kinds.get(command);
}
