import { CommanderError } from "commander";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

import packageJson from "../../package.json" with { type: "json" };
import { createProgram } from "./program.js";

let tempHome = "";

afterEach(async () => {
  if (tempHome) await rm(tempHome, { recursive: true, force: true });
  tempHome = "";
});

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

  it("registers the flows run subcommand", () => {
    const program = createProgram();
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

  it("emits one error when flows pull is unauthenticated", async () => {
    tempHome = await mkdtemp(join(tmpdir(), "qawolf-cli-home-"));
    const env = { ...process.env, HOME: tempHome, QAWOLF_API_KEY: undefined };
    const proc = Bun.spawn(
      ["bun", "src/main.ts", "--json", "flows", "pull", "--env", "env-abc"],
      {
        cwd: process.cwd(),
        env,
        stderr: "pipe",
        stdout: "pipe",
      },
    );

    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    const errors = stderr
      .split("\n")
      .filter((line) => line.includes('"type":"error"'));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"title":"not authenticated"');
  });
});
