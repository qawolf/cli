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
});
