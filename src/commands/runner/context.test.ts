import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Command, CommanderError } from "commander";

import { createProgram } from "~/commands/program.js";
import { makeMockPlatformClient } from "~/shell/platform/createPlatformClient.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { withRunnerContext, workspaceIdOption } from "./context.js";

const signals = makeNoopSignals();

beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = 0;
});

/**
 * A `runner` group shaped like the real one, with one subcommand whose action
 * records the workspace the platform client was built for.
 */
function makeRunnerGroup(savedWorkspaceId: string | undefined): {
  program: Command;
  sent: () => (string | undefined)[];
} {
  const workspaces: (string | undefined)[] = [];
  const program = new Command().exitOverride();
  const runner = program
    .command("runner")
    .addOption(workspaceIdOption())
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  runner.command("terminate").action((opts: unknown, command: Command) =>
    withRunnerContext(signals, async () => undefined, {
      requireApiKey: async () => ({
        key: "qawolf_test",
        source: "browser",
        workspaceId: savedWorkspaceId,
      }),
      createPlatform: (_key, deps) => {
        workspaces.push(deps.workspaceId);
        return makeMockPlatformClient();
      },
    })(opts, command),
  );
  return { program, sent: () => workspaces };
}

describe("qawolf runner --workspace-id", () => {
  it("works in the named workspace instead of the saved one", async () => {
    const { program, sent } = makeRunnerGroup("ws_saved");

    await program.parseAsync(
      ["runner", "terminate", "--workspace-id", "ws_named"],
      { from: "user" },
    );

    expect(sent()).toEqual(["ws_named"]);
  });

  it("takes the flag before the subcommand as well as after it", async () => {
    const { program, sent } = makeRunnerGroup("ws_saved");

    await program.parseAsync(
      ["runner", "--workspace-id", "ws_named", "terminate"],
      { from: "user" },
    );

    expect(sent()).toEqual(["ws_named"]);
  });

  it("falls back to the saved workspace without the flag", async () => {
    const { program, sent } = makeRunnerGroup("ws_saved");

    await program.parseAsync(["runner", "terminate"], { from: "user" });

    expect(sent()).toEqual(["ws_saved"]);
  });

  it("names a workspace for a credential that saved none, such as an API key", async () => {
    const { program, sent } = makeRunnerGroup(undefined);

    await program.parseAsync(
      ["runner", "terminate", "--workspace-id", "ws_named"],
      { from: "user" },
    );

    expect(sent()).toEqual(["ws_named"]);
  });

  it("trims the id it is given", async () => {
    const { program, sent } = makeRunnerGroup("ws_saved");

    await program.parseAsync(
      ["runner", "terminate", "--workspace-id", " ws_named "],
      { from: "user" },
    );

    expect(sent()).toEqual(["ws_named"]);
  });

  it("refuses a blank id rather than sending no workspace", async () => {
    const { program, sent } = makeRunnerGroup("ws_saved");

    let caught: unknown;
    try {
      await program.parseAsync(
        ["runner", "terminate", "--workspace-id", "  "],
        { from: "user" },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CommanderError);
    expect((caught as CommanderError).code).toBe("commander.invalidArgument");
    expect(sent()).toEqual([]);
  });
});

describe("qawolf runner subcommands", () => {
  it("each list --workspace-id in their help", () => {
    const program = createProgram({ signals: makeNoopSignals() });
    const runner = program.commands.find((c) => c.name() === "runner");
    if (runner === undefined) throw Error("runner group not registered");

    expect(runner.commands.length).toBeGreaterThan(0);
    for (const subcommand of runner.commands) {
      expect(subcommand.helpInformation()).toContain("--workspace-id <id>");
    }
  });
});
