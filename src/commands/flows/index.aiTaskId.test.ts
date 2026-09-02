import { afterEach, expect, it } from "bun:test";
import { Command } from "commander";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx, makeFakeUI } from "~/shell/commandContext.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerFlowsCommand } from "./index.js";
import type { withResolvedEnv } from "./withResolvedEnv.js";

const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
  ok: true,
  value: { flows: [] },
});

// The remote listing runs behind withResolvedEnv, which resolves an API key
// and a real platform client. Standing in for it is the smallest seam that
// still exercises the command's own option-to-request wiring.
const fakeWithResolvedEnv: typeof withResolvedEnv =
  (_signals, args, fn) => async (): Promise<void> => {
    const ctx: AuthCommandContext = {
      ...makeCtx("json"),
      ui: { ...makeFakeUI("json"), mode: "json" },
      apiKeySource: "env",
      platformClient: makeMockPlatformClient({ callPublicApi }),
    };
    await fn(ctx, args.explicit ?? "environment-id", {
      slug: undefined,
      name: undefined,
    });
  };

const originalAiTaskId = process.env["QAWOLF_AI_TASK_ID"];

afterEach(() => {
  process.exitCode = 0;
  callPublicApi.mockClear();
  if (originalAiTaskId === undefined) {
    delete process.env["QAWOLF_AI_TASK_ID"];
  } else {
    process.env["QAWOLF_AI_TASK_ID"] = originalAiTaskId;
  }
});

async function listRemote(extraArgs: string[]): Promise<void> {
  const program = new Command().name("qawolf").exitOverride();
  registerFlowsCommand(program, createSignalRegistry(), {
    withResolvedEnv: fakeWithResolvedEnv,
  });
  await program.parseAsync(
    ["flows", "list", "--remote", "--env", "staging", ...extraArgs],
    { from: "user" },
  );
}

function requestedAiTaskId(): unknown {
  const call = callPublicApi.mock.calls[0];
  if (call === undefined) throw new Error("flow.list was never requested");
  expect(call[0]).toBe(publicContractsV1.flow.list);
  return (call[1] as { aiTaskId: unknown }).aiTaskId;
}

it("forwards --ai-task-id to flow.list", async () => {
  delete process.env["QAWOLF_AI_TASK_ID"];

  await listRemote(["--ai-task-id", "flag-task-id"]);

  expect(requestedAiTaskId()).toBe("flag-task-id");
});

it("defaults --ai-task-id from QAWOLF_AI_TASK_ID", async () => {
  process.env["QAWOLF_AI_TASK_ID"] = "environment-task-id";

  await listRemote([]);

  expect(requestedAiTaskId()).toBe("environment-task-id");
});

it("prefers an explicit --ai-task-id over QAWOLF_AI_TASK_ID", async () => {
  process.env["QAWOLF_AI_TASK_ID"] = "environment-task-id";

  await listRemote(["--ai-task-id", "flag-task-id"]);

  expect(requestedAiTaskId()).toBe("flag-task-id");
});

it("omits aiTaskId when neither the flag nor the variable is set", async () => {
  delete process.env["QAWOLF_AI_TASK_ID"];

  await listRemote([]);

  expect(requestedAiTaskId()).toBeUndefined();
});
