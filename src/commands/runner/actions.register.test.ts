import { type Command, CommanderError } from "commander";
import { describe, expect, it } from "bun:test";

import { createProgram } from "~/commands/program.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

function subcommand(parent: Command, name: string): Command {
  const found = parent.commands.find((command) => command.name() === name);
  if (found === undefined) throw Error(`subcommand not found: ${name}`);
  return found;
}

// Commander copies the exit callback into a subcommand when it is created, so
// the one the parse has to leave by is the one set on the subcommand itself.
async function parseActions(args: string[]): Promise<unknown> {
  const program = createProgram({ signals: makeNoopSignals() });
  subcommand(subcommand(program, "runner"), "actions")
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  try {
    await program.parseAsync(["runner", "actions", ...args], { from: "user" });
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("qawolf runner actions", () => {
  it("refuses a screenshot mode it does not have", async () => {
    const error = await parseActions(["[]", "--screenshot-mode", "finals"]);

    expect(error).toBeInstanceOf(CommanderError);
    expect((error as CommanderError).code).toBe("commander.invalidArgument");
    expect((error as CommanderError).message).toContain("none, final, each");
  });
});
