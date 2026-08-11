import { afterEach, expect, it } from "bun:test";
import { Command } from "commander";
import { z } from "zod";

import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";

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

afterEach(() => {
  delete process.env["QAWOLF_AI_TASK_ID"];
});

async function runCreate({ aiTaskId }: { aiTaskId?: string } = {}) {
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { runId: "run-id" },
  });
  const program = new Command().name("qawolf").exitOverride();
  registerPublicApiCommands(program, createSignalRegistry(), {
    authDeps: {
      requireApiKey: async () => ({ key: "qawolf_key", source: "env" }),
      createPlatform: () => makeMockPlatformClient({ callPublicApi }),
    },
    contracts: { run: { create: contract } },
  });
  const args = ["run", "create", "--environment-id", "environment-id"];
  if (aiTaskId) args.push("--ai-task-id", aiTaskId);
  await program.parseAsync(args, { from: "user" });
  return callPublicApi;
}

it("defaults the generated run.create AI task option from the environment", async () => {
  process.env["QAWOLF_AI_TASK_ID"] = "task-from-env";

  const callPublicApi = await runCreate();

  expect(callPublicApi).toHaveBeenCalledWith(contract, {
    aiTaskId: "task-from-env",
    environmentId: "environment-id",
  });
});

it("prefers an explicit AI task option over the environment", async () => {
  process.env["QAWOLF_AI_TASK_ID"] = "task-from-env";

  const callPublicApi = await runCreate({ aiTaskId: "task-from-flag" });

  expect(callPublicApi).toHaveBeenCalledWith(contract, {
    aiTaskId: "task-from-flag",
    environmentId: "environment-id",
  });
});
