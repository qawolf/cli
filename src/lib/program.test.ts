import { CommanderError } from "commander";
import { describe, expect, it } from "bun:test";

import packageJson from "../../package.json" with { type: "json" };
import { createProgram } from "./program.js";

function silentProgram() {
  return createProgram()
    .exitOverride()
    .configureOutput({ writeOut: () => {}, writeErr: () => {} });
}

describe("createProgram", () => {
  // Best-effort: ensures the version at least aligns with package.json, but
  // cannot prove the value is dynamically derived rather than hardcoded.
  it("version matches package.json", () => {
    expect(createProgram().version()).toBe(packageJson.version);
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
    const program = createProgram();
    const install = program.commands.find((c) => c.name() === "install");
    expect(install).toBeDefined();
    const browsers = install?.commands.find((c) => c.name() === "browsers");
    expect(browsers).toBeDefined();
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
