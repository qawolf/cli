import { describe, expect, it } from "bun:test";
import { Command } from "commander";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "~/commands/program.js";
import { registerAttemptCommand } from "./index.js";

function subcommand(parent: Command, name: string): Command {
  const command = parent.commands.find(
    (candidate) => candidate.name() === name,
  );
  if (!command) throw new Error(`Missing command: ${name}`);
  return command;
}

function attemptProgram(): Command {
  const program = new Command().exitOverride();
  program.configureOutput({ writeErr: () => {}, writeOut: () => {} });
  registerAttemptCommand(program, makeNoopSignals());
  return program;
}

describe("attempt command registration", () => {
  it("keeps generated investigation get separate from attempt commands", () => {
    const program = createProgram({ signals: makeNoopSignals() });
    const attempt = subcommand(program, "attempt");
    const investigation = subcommand(program, "investigation");

    expect(attempt.commands.map((command) => command.name())).toEqual([
      "investigate",
      "inspect",
    ]);
    expect(investigation.commands.map((command) => command.name())).toContain(
      "get",
    );
  });

  it("requires one selector before entering authenticated command handling", () => {
    const missing = attemptProgram().parseAsync(["attempt", "inspect", "a1"], {
      from: "user",
    });
    expect(missing).rejects.toThrow("Choose exactly one evidence selector");

    const conflicting = attemptProgram().parseAsync(
      ["attempt", "inspect", "a1", "--timeline", "--network"],
      { from: "user" },
    );
    expect(conflicting).rejects.toThrow("Choose exactly one evidence selector");
  });

  it("exposes only the selector-based inspect surface", () => {
    const inspect = subcommand(
      subcommand(attemptProgram(), "attempt"),
      "inspect",
    );
    const flags = inspect.options.map((option) => option.long);

    for (const selector of [
      "--action",
      "--timeline",
      "--network",
      "--request",
      "--snapshot",
      "--screenshot",
      "--console",
      "--log",
      "--evidence-id",
    ])
      expect(flags).toContain(selector);
    expect(flags).not.toContain("--attempt-id");
    expect(flags).not.toContain("--type");
  });
});
