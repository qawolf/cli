import { afterEach, expect, it } from "bun:test";
import { Command } from "commander";
import { z } from "zod";

import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";

const originalAiTaskId = process.env["QAWOLF_AI_TASK_ID"];

afterEach(() => {
  process.exitCode = undefined;
  if (originalAiTaskId === undefined) {
    delete process.env["QAWOLF_AI_TASK_ID"];
  } else {
    process.env["QAWOLF_AI_TASK_ID"] = originalAiTaskId;
  }
});

it("defaults the run create AI task id from the environment", async () => {
  const contract = {
    description: "Create a run.",
    input: z.object({
      aiTaskId: z.string().optional(),
      environmentId: z.string(),
    }),
    kind: "write",
    name: "run.create",
    output: z.object({ runId: z.string() }),
  } as const;
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { runId: "run-id" },
  });
  const register = () => {
    const program = new Command().name("qawolf").exitOverride();
    registerPublicApiCommands(program, createSignalRegistry(), {
      authDeps: {
        requireApiKey: async () => ({ key: "qawolf_key", source: "env" }),
        createPlatform: () => makeMockPlatformClient({ callPublicApi }),
      },
      contracts: { run: { create: contract } },
    });
    return program;
  };
  process.env["QAWOLF_AI_TASK_ID"] = "environment-task-id";

  await register().parseAsync(
    ["run", "create", "--environment-id", "environment-id"],
    { from: "user" },
  );
  await register().parseAsync(
    [
      "run",
      "create",
      "--ai-task-id",
      "flag-task-id",
      "--environment-id",
      "environment-id",
    ],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenNthCalledWith(1, contract, {
    aiTaskId: "environment-task-id",
    environmentId: "environment-id",
  });
  expect(callPublicApi).toHaveBeenNthCalledWith(2, contract, {
    aiTaskId: "flag-task-id",
    environmentId: "environment-id",
  });
});
