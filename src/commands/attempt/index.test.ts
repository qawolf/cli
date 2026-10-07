import { describe, expect, it } from "bun:test";
import { Command } from "commander";
import { z } from "zod";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "~/commands/program.js";
import { registerPublicApiCommands } from "~/commands/publicApi/index.js";
import { standInAnnotationJustifications } from "~/domains/publicApi/contract.fixtures.js";
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
      "get",
    ]);
    expect(investigation.commands.map((command) => command.name())).toContain(
      "get",
    );
  });

  it("shares the attempt group with commands generated from an attempt contract", () => {
    const program = attemptProgram();
    registerPublicApiCommands(program, makeNoopSignals(), {
      contracts: {
        attempt: {
          get: {
            annotationJustifications: standInAnnotationJustifications,
            annotations: {
              destructiveHint: false,
              openWorldHint: false,
              readOnlyHint: true,
            },
            description: "Synthetic attempt contract.",
            input: z.object({ attemptId: z.string() }),
            kind: "read" as const,
            name: "attempt.get",
            output: z.object({ attemptId: z.string() }),
          },
        },
      },
    });

    expect(
      program.commands.filter((command) => command.name() === "attempt"),
    ).toHaveLength(1);
    expect(
      subcommand(program, "attempt").commands.map((command) => command.name()),
    ).toEqual(["investigate", "inspect", "get"]);
  });

  it("requires one selector before entering authenticated command handling", () => {
    const missing = attemptProgram().parseAsync(
      ["attempt", "inspect", "--attempt-id", "a1"],
      { from: "user" },
    );
    expect(missing).rejects.toThrow("Choose exactly one evidence selector");

    const conflicting = attemptProgram().parseAsync(
      ["attempt", "inspect", "--attempt-id", "a1", "--timeline", "--network"],
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
      "--attempt-id",
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
    expect(flags).not.toContain("--type");
  });
});
