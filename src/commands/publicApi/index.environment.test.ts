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
const originalEnvironment = process.env["QAWOLF_ENVIRONMENT"];

afterEach(() => {
  process.exitCode = undefined;
  if (originalAiTaskId === undefined) {
    delete process.env["QAWOLF_AI_TASK_ID"];
  } else {
    process.env["QAWOLF_AI_TASK_ID"] = originalAiTaskId;
  }
  if (originalEnvironment === undefined) {
    delete process.env["QAWOLF_ENVIRONMENT"];
  } else {
    process.env["QAWOLF_ENVIRONMENT"] = originalEnvironment;
  }
});

it("defaults public API options from their environment variables", async () => {
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
  process.env["QAWOLF_ENVIRONMENT"] = "environment-environment-id";

  await register().parseAsync(["run", "create"], { from: "user" });
  await register().parseAsync(
    [
      "run",
      "create",
      "--ai-task-id",
      "flag-task-id",
      "--environment-id",
      "flag-environment-id",
    ],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenNthCalledWith(1, contract, {
    aiTaskId: "environment-task-id",
    environmentId: "environment-environment-id",
  });
  expect(callPublicApi).toHaveBeenNthCalledWith(2, contract, {
    aiTaskId: "flag-task-id",
    environmentId: "flag-environment-id",
  });
});
