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
