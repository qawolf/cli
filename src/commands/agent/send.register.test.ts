import type { Command } from "commander";
import { describe, expect, it } from "bun:test";

import { createProgram } from "~/commands/program.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

function find(parent: Command, name: string): Command {
  const command = parent.commands.find((child) => child.name() === name);
  if (!command) throw Error(`Missing command ${name}`);
  return command;
}

async function parseOptions(args: string[]) {
  const program = createProgram({ signals: makeNoopSignals() });
  const command = find(find(program, "agent"), "send");
  let options: unknown;
  command
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  // Capture real Commander option parsing without authenticating.
  command.action((_message: string, opts: unknown) => {
    options = opts;
  });
  await program.parseAsync(["agent", "send", "test the build", ...args], {
    from: "user",
  });
  return options;
}

describe("agent send --builds", () => {
  const first = "abcdefghij0123456789klmnobld";
  const second = "0123456789abcdefghijklmnobld";

  it("takes several space-separated build ids", async () => {
    expect(await parseOptions(["--builds", first, second])).toMatchObject({
      builds: [first, second],
    });
  });

  it("adds the ids of a repeated --builds", async () => {
    expect(
      await parseOptions(["--builds", first, "--builds", second]),
    ).toMatchObject({ builds: [first, second] });
  });

  it("sends no builds when not given", async () => {
    expect(await parseOptions([])).not.toHaveProperty("builds");
  });
});
