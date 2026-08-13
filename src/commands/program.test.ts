import { CommanderError } from "commander";
import { describe, expect, it } from "bun:test";

import packageJson from "../../package.json" with { type: "json" };
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "./program.js";

const noopSignals = makeNoopSignals();

function silentProgram() {
  return createProgram({ signals: noopSignals })
    .exitOverride()
    .configureOutput({ writeOut: () => {}, writeErr: () => {} });
}

describe("createProgram", () => {
  // Best-effort: ensures the version at least aligns with package.json, but
  // cannot prove the value is dynamically derived rather than hardcoded.
  it("version matches package.json", () => {
    expect(createProgram({ signals: noopSignals }).version()).toBe(
      packageJson.version,
    );
  });

  it("--version exits cleanly", () => {
    let err: unknown;
    try {
      silentProgram().parse(["--version"], { from: "user" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).code).toBe("commander.version");
    expect((err as CommanderError).exitCode).toBe(0);
  });

  it("--help exits cleanly", () => {
    let err: unknown;
    try {
      silentProgram().parse(["--help"], { from: "user" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).code).toBe("commander.helpDisplayed");
    expect((err as CommanderError).exitCode).toBe(0);
  });

  it("throws on unknown command", () => {
    let err: unknown;
    try {
      silentProgram().parse(["unknown-command"], { from: "user" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).code).toBe("commander.unknownCommand");
  });

  it("registers the install browsers subcommand", () => {
    const program = createProgram({ signals: noopSignals });
    const install = program.commands.find((c) => c.name() === "install");
    expect(install).toBeDefined();
    const browsers = install?.commands.find((c) => c.name() === "browsers");
    expect(browsers).toBeDefined();
  });

  it("registers the init command", () => {
    const program = createProgram({ signals: noopSignals });
    const init = program.commands.find((c) => c.name() === "init");
    expect(init).toBeDefined();
  });

  it("registers the flows run subcommand", () => {
    const program = createProgram({ signals: noopSignals });
    const flows = program.commands.find((c) => c.name() === "flows");
    expect(flows).toBeDefined();
    const run = flows?.commands.find((c) => c.name() === "run");
    expect(run).toBeDefined();
  });

  it("registers --no-browser-deps (default true) on flows run, install, and install browsers", () => {
    const program = createProgram({ signals: noopSignals });
    const flows = program.commands.find((c) => c.name() === "flows");
    const run = flows?.commands.find((c) => c.name() === "run");
    const install = program.commands.find((c) => c.name() === "install");
    const browsers = install?.commands.find((c) => c.name() === "browsers");

    for (const command of [run, install, browsers]) {
      expect(command).toBeDefined();
      const option = command?.options.find(
        (o) => o.long === "--no-browser-deps",
      );
      expect(option).toBeDefined();
      expect(command?.getOptionValue("browserDeps")).toBe(true);
    }
  });

  // A program-level option matches anywhere on the command line, so a
  // subcommand redefining one gets a flag that parses but never reaches its
  // handler: the program consumes it first.
  it("no subcommand redefines a program-level option", () => {
    const program = createProgram({ signals: noopSignals });
    const globalFlags = new Set(program.options.map((option) => option.long));

    const collisions: string[] = [];
    const walk = (commands: readonly (typeof program)[]): void => {
      for (const command of commands) {
        for (const option of command.options) {
          if (option.long !== undefined && globalFlags.has(option.long)) {
            collisions.push(`${command.name()} ${option.long}`);
          }
        }
        walk(command.commands as (typeof program)[]);
      }
    };
    walk(program.commands as (typeof program)[]);

    expect(collisions).toEqual([]);
  });

  it("throws on unknown option", () => {
    let err: unknown;
    try {
      silentProgram().parse(["--unknown-option"], { from: "user" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).code).toBe("commander.unknownOption");
  });
});

describe("public API commands", () => {
  it("registers `run create` from the published contracts", () => {
    const program = createProgram({ signals: noopSignals });

    const run = program.commands.find((command) => command.name() === "run");
    const create = run?.commands.find((command) => command.name() === "create");
    expect(create).toBeDefined();
  });
});
