import { afterEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";

afterEach(() => {
  mock.restore();
  process.exitCode = undefined;
});

function makeProgram(): Command {
  return new Command().name("qawolf").exitOverride();
}

describe("registerPublicApiCommands", () => {
  it("registers a command per contract with flags from the input schema", () => {
    const program = makeProgram();

    registerPublicApiCommands(program, createSignalRegistry());

    const run = program.commands.find((command) => command.name() === "run");
    expect(run).toBeDefined();
    const create = run?.commands.find((command) => command.name() === "create");
    expect(create).toBeDefined();
    expect(create?.description()).toBe(
      publicContractsV1.run.create.description,
    );
    expect(create?.options.map((option) => option.flags)).toEqual([
      "--environment-id <value>",
      "--environment-variables <KEY=VALUE...>",
      "--flow-ids <values...>",
      "--ignore-rules",
    ]);
    expect(create?.options.map((option) => option.mandatory)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it("invokes the contract through the platform client when the command runs", async () => {
    const environmentId = "environment-id";
    const flowId = "flow-id";
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { runId: "run-id" },
    });
    const program = makeProgram();
    registerPublicApiCommands(program, createSignalRegistry(), {
      authDeps: {
        requireApiKey: async () => ({ key: "qawolf_key", source: "env" }),
        createPlatform: () => makeMockPlatformClient({ callPublicApi }),
      },
    });

    await program.parseAsync(
      [
        "run",
        "create",
        "--environment-id",
        environmentId,
        "--flow-ids",
        flowId,
      ],
      { from: "user" },
    );

    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.run.create, {
      environmentId,
      flowIds: [flowId],
      ignoreRules: false,
    });
  });

  it("throws when a generated command collides with an existing command", () => {
    const program = makeProgram();
    program.command("run").command("create");

    expect(() =>
      registerPublicApiCommands(program, createSignalRegistry()),
    ).toThrow('Generated command "run create" collides');
  });

  it("registers nested namespaces from custom contract trees", () => {
    const contract = {
      description: "Look up a run attempt.",
      input: z.object({ runId: z.string() }),
      kind: "read",
      name: "run.attempt.get",
      output: z.object({ status: z.string() }),
    } as const;
    const program = makeProgram();

    registerPublicApiCommands(program, createSignalRegistry(), {
      contracts: { run: { attempt: { get: contract } } },
    });

    const get = program.commands
      .find((command) => command.name() === "run")
      ?.commands.find((command) => command.name() === "attempt")
      ?.commands.find((command) => command.name() === "get");
    expect(get).toBeDefined();
    expect(get?.description()).toBe("Look up a run attempt.");
  });
});
