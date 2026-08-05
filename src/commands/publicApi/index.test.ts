import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
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
    expect(run?.description()).toBe(
      "Trigger and manage QA Wolf runs on the platform",
    );
    const create = run?.commands.find((command) => command.name() === "create");
    expect(create).toBeDefined();
    expect(create?.description()).toBe(
      publicContractsV1.run.create.description,
    );
    expect(create?.options.map((option) => option.flags)).toEqual([
      "--env, --environment-id <value>",
      "--environment-variables <KEY=VALUE...>",
      "--ignore-rules",
      "--pull-request-number <value>",
      "--repository <value>",
      "--flow-ids <values...>",
      "--tag-names <values...>",
    ]);
    expect(create?.options.map((option) => option.mandatory)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
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
      tagNames: [],
    });
  });

  it("fills the environmentId contract field from --env", async () => {
    const environmentId = "environment-id";
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
      ["run", "create", "--env", environmentId, "--flow-ids", "flow-id"],
      { from: "user" },
    );

    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.run.create, {
      environmentId,
      flowIds: ["flow-id"],
      ignoreRules: false,
      tagNames: [],
    });
  });

  it("emits the structured response as a JSON line on stdout in agent mode", async () => {
    const stdout = spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );
    const stderr = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { runId: "run-id" },
    });
    const program = makeProgram().option(
      "--agent",
      "Output for agent consumption",
    );
    registerPublicApiCommands(program, createSignalRegistry(), {
      authDeps: {
        requireApiKey: async () => ({ key: "qawolf_key", source: "env" }),
        createPlatform: () => makeMockPlatformClient({ callPublicApi }),
      },
    });

    await program.parseAsync(
      [
        "--agent",
        "run",
        "create",
        "--environment-id",
        "environment-id",
        "--flow-ids",
        "flow-id",
      ],
      { from: "user" },
    );

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({ runId: "run-id" }) + "\n",
    );
    expect(stderr).toHaveBeenCalledWith("runId: run-id\n");
  });

  it("throws when a generated command collides with an existing command", () => {
    const program = makeProgram();
    program.command("run").command("create");

    expect(() =>
      registerPublicApiCommands(program, createSignalRegistry()),
    ).toThrow('Generated command "run create" collides');
  });

  it("skips contracts served by hand-written commands", () => {
    const listContract = {
      description: "List the flows of an environment.",
      input: z.object({ environmentId: z.string() }),
      kind: "read",
      name: "flow.list",
      output: z.object({ flows: z.array(z.object({ flowId: z.string() })) }),
    } as const;
    const getContract = {
      description: "Look up a run.",
      input: z.object({ runId: z.string() }),
      kind: "read",
      name: "run.get",
      output: z.object({ status: z.string() }),
    } as const;
    const program = makeProgram();

    registerPublicApiCommands(program, createSignalRegistry(), {
      contracts: { flow: { list: listContract }, run: { get: getContract } },
    });

    // No `flow` group either: skipped contracts create no empty namespaces.
    expect(
      program.commands.find((command) => command.name() === "flow"),
    ).toBeUndefined();
    const run = program.commands.find((command) => command.name() === "run");
    expect(
      run?.commands.find((command) => command.name() === "get"),
    ).toBeDefined();
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

    const attempt = program.commands
      .find((command) => command.name() === "run")
      ?.commands.find((command) => command.name() === "attempt");
    expect(attempt?.description()).toBe("QA Wolf public API attempt commands");
    const get = attempt?.commands.find((command) => command.name() === "get");
    expect(get).toBeDefined();
    expect(get?.description()).toBe("Look up a run attempt.");
  });
});
