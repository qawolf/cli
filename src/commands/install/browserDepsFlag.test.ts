import { describe, expect, it } from "bun:test";
import { Command } from "commander";

import { mergedBrowserDeps } from "./browserDepsFlag.js";

// Mirrors the real `install` / `install browsers` registration: both commands
// define --no-browser-deps. In Commander's default parsing mode the parent
// consumes the flag even when it is written after the subcommand name, so the
// subcommand must merge its own opts with the parent's.
function makeInstallLikeProgram(onAction: (merged: boolean) => void): Command {
  const program = new Command()
    .name("install")
    .option("--no-browser-deps")
    .exitOverride();
  program
    .command("browsers")
    .option("--no-browser-deps")
    .action((opts: { browserDeps: boolean }, command: Command) => {
      onAction(mergedBrowserDeps(opts.browserDeps, command));
    });
  return program;
}

describe("mergedBrowserDeps", () => {
  it("is false when the parent consumed --no-browser-deps written after the subcommand", async () => {
    let seen: boolean | undefined;
    const program = makeInstallLikeProgram((merged) => {
      seen = merged;
    });

    await program.parseAsync(["browsers", "--no-browser-deps"], {
      from: "user",
    });

    expect(seen).toBe(false);
  });

  it("is true when the flag is not passed at all", async () => {
    let seen: boolean | undefined;
    const program = makeInstallLikeProgram((merged) => {
      seen = merged;
    });

    await program.parseAsync(["browsers"], { from: "user" });

    expect(seen).toBe(true);
  });

  it("is false without a parent when the subcommand itself parsed the flag", () => {
    expect(mergedBrowserDeps(false, new Command())).toBe(false);
  });
});
