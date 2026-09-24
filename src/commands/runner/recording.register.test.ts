import { type Command, CommanderError } from "commander";
import { describe, expect, it } from "bun:test";

import { getCommandKind } from "~/commands/commandKind.js";
import { createProgram } from "~/commands/program.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

function find(parent: Command, name: string): Command {
  const command = parent.commands.find((child) => child.name() === name);
  if (!command) throw Error(`Missing command ${name}`);
  return command;
}

async function parse(verb: string, args: string[]) {
  const program = createProgram({ signals: makeNoopSignals() });
  const command = find(find(find(program, "runner"), "record"), verb);
  let parsed: unknown;
  command
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  // Capture real Commander argument/option placement without authenticating.
  command.action((...values: unknown[]) => {
    parsed = values.slice(0, -1);
  });
  await program.parseAsync(["runner", "record", verb, ...args], {
    from: "user",
  });
  return parsed;
}

describe("recording command arguments", () => {
  it("requires a UUID argument for stop", async () => {
    expect(parse("stop", [])).rejects.toBeInstanceOf(CommanderError);
  });

  it("refuses automatic settings other than on and off", async () => {
    expect(parse("auto", ["yes"])).rejects.toMatchObject({
      code: "commander.invalidArgument",
    });
  });

  it("parses stop's recording id separately from its runner id", async () => {
    expect(await parse("stop", ["recording-uuid", "--runner", "ci"])).toEqual([
      "recording-uuid",
      { runner: "ci" },
    ]);
  });

  it("classifies status and history as reads and controls as writes", () => {
    const runner = find(
      createProgram({ signals: makeNoopSignals() }),
      "runner",
    );
    const record = find(runner, "record");
    expect(getCommandKind(find(record, "status"))?.kind).toBe("read");
    expect(getCommandKind(find(runner, "list-recordings"))?.kind).toBe("read");
    for (const verb of ["start", "stop", "auto"]) {
      expect(getCommandKind(find(record, verb))?.kind).toBe("write");
    }
  });
});
