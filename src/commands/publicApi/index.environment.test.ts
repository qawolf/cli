import { afterEach, expect, it } from "bun:test";
import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";
import { Command } from "commander";
import { z } from "zod";

import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";

const originalAiTaskId = process.env["QAWOLF_AI_TASK_ID"];
const originalChatSessionId = process.env["QAWOLF_CHAT_SESSION_ID"];
const originalEnvironment = process.env["QAWOLF_ENVIRONMENT"];

afterEach(() => {
  process.exitCode = undefined;
  if (originalAiTaskId === undefined) {
    delete process.env["QAWOLF_AI_TASK_ID"];
  } else {
    process.env["QAWOLF_AI_TASK_ID"] = originalAiTaskId;
  }
  if (originalChatSessionId === undefined) {
    delete process.env["QAWOLF_CHAT_SESSION_ID"];
  } else {
    process.env["QAWOLF_CHAT_SESSION_ID"] = originalChatSessionId;
  }
  if (originalEnvironment === undefined) {
    delete process.env["QAWOLF_ENVIRONMENT"];
  } else {
    process.env["QAWOLF_ENVIRONMENT"] = originalEnvironment;
  }
});

// Stands in for the published run.create: both notification ids, optional,
// beside the required environment. The published contract rejects the pair,
// which is what the CLI must never send; the stand-in accepts it so a test can
// see which id the CLI chose.
function makeNotificationContract() {
  return {
    description: "Create a run.",
    input: z.object({
      aiTaskId: z.string().optional(),
      chatSessionId: z.string().optional(),
      environmentId: z.string(),
    }),
    kind: "write",
    name: "run.create",
    output: z.object({ runId: z.string(), tracking: z.string() }),
  } as const;
}

// A fresh program per invocation: Commander reads an environment variable when
// the option is parsed, so a program built before the variable was set would
// not see it.
function registerRunCreate(
  contract: AnyPublicApiContract,
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>,
): Command {
  const program = new Command().name("qawolf").exitOverride();
  registerPublicApiCommands(program, createSignalRegistry(), {
    authDeps: {
      requireApiKey: async () => ({
        key: "qawolf_key",
        source: "env",
        workspaceId: undefined,
      }),
      createPlatform: () => makeMockPlatformClient({ callPublicApi }),
    },
    contracts: { run: { create: contract } },
  });
  return program;
}

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
  process.env["QAWOLF_AI_TASK_ID"] = "environment-task-id";
  process.env["QAWOLF_ENVIRONMENT"] = "environment-environment-id";

  await registerRunCreate(contract, callPublicApi).parseAsync(
    ["run", "create"],
    { from: "user" },
  );
  await registerRunCreate(contract, callPublicApi).parseAsync(
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

// A Global Chat pod exports QAWOLF_CHAT_SESSION_ID, and a run created there
// reports its result back into that chat only if the id reaches the request.
it("defaults run.create chatSessionId from QAWOLF_CHAT_SESSION_ID", async () => {
  const contract = makeNotificationContract();
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { runId: "run-id", tracking: "registered" },
  });
  delete process.env["QAWOLF_AI_TASK_ID"];
  process.env["QAWOLF_CHAT_SESSION_ID"] = "environment-chat-session-id";
  process.env["QAWOLF_ENVIRONMENT"] = "environment-environment-id";

  await registerRunCreate(contract, callPublicApi).parseAsync(
    ["run", "create"],
    { from: "user" },
  );
  await registerRunCreate(contract, callPublicApi).parseAsync(
    ["run", "create", "--chat-session-id", "flag-chat-session-id"],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenNthCalledWith(1, contract, {
    chatSessionId: "environment-chat-session-id",
    environmentId: "environment-environment-id",
  });
  expect(callPublicApi).toHaveBeenNthCalledWith(2, contract, {
    chatSessionId: "flag-chat-session-id",
    environmentId: "environment-environment-id",
  });
});

// An AI task pod that holds a conversation exports both variables, and the
// contract rejects a request carrying the pair, so the CLI sends the task id
// alone: the id such a pod already sends today, and the one whose conversation
// is the task's own chat session.
it("sends aiTaskId alone when both variables are set", async () => {
  const contract = makeNotificationContract();
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { runId: "run-id", tracking: "registered" },
  });
  process.env["QAWOLF_AI_TASK_ID"] = "environment-task-id";
  process.env["QAWOLF_CHAT_SESSION_ID"] = "environment-chat-session-id";
  process.env["QAWOLF_ENVIRONMENT"] = "environment-environment-id";

  await registerRunCreate(contract, callPublicApi).parseAsync(
    ["run", "create"],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenCalledWith(contract, {
    aiTaskId: "environment-task-id",
    environmentId: "environment-environment-id",
  });
});

it("prefers an explicit --chat-session-id over an ambient QAWOLF_AI_TASK_ID", async () => {
  const contract = makeNotificationContract();
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { runId: "run-id", tracking: "registered" },
  });
  process.env["QAWOLF_AI_TASK_ID"] = "environment-task-id";
  process.env["QAWOLF_CHAT_SESSION_ID"] = "environment-chat-session-id";
  process.env["QAWOLF_ENVIRONMENT"] = "environment-environment-id";

  await registerRunCreate(contract, callPublicApi).parseAsync(
    ["run", "create", "--chat-session-id", "flag-chat-session-id"],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenCalledWith(contract, {
    chatSessionId: "flag-chat-session-id",
    environmentId: "environment-environment-id",
  });
});

it("omits chatSessionId when neither the flag nor the variable is set", async () => {
  const contract = makeNotificationContract();
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { runId: "run-id", tracking: "not-requested" },
  });
  delete process.env["QAWOLF_AI_TASK_ID"];
  delete process.env["QAWOLF_CHAT_SESSION_ID"];
  process.env["QAWOLF_ENVIRONMENT"] = "environment-environment-id";

  await registerRunCreate(contract, callPublicApi).parseAsync(
    ["run", "create"],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenCalledWith(contract, {
    environmentId: "environment-environment-id",
  });
});
