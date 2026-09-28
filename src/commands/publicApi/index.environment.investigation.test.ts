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

const originalChatSessionId = process.env["QAWOLF_CHAT_SESSION_ID"];

afterEach(() => {
  process.exitCode = undefined;
  if (originalChatSessionId === undefined) {
    delete process.env["QAWOLF_CHAT_SESSION_ID"];
  } else {
    process.env["QAWOLF_CHAT_SESSION_ID"] = originalChatSessionId;
  }
});

function makeRecordFindingContract() {
  return {
    annotations: {
      destructiveHint: true,
      openWorldHint: false,
      readOnlyHint: false,
    },
    description: "Record a finding.",
    input: z.object({ runId: z.string(), sessionId: z.string() }),
    kind: "write",
    name: "investigation.recordFinding",
    output: z.object({ findingId: z.string() }),
  } as const;
}

function registerRecordFinding(
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
    contracts: { investigation: { recordFinding: contract } },
  });
  return program;
}

it("defaults investigation.recordFinding sessionId from QAWOLF_CHAT_SESSION_ID", async () => {
  const contract = makeRecordFindingContract();
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { findingId: "finding-id" },
  });
  process.env["QAWOLF_CHAT_SESSION_ID"] = "environment-chat-session-id";

  await registerRecordFinding(contract, callPublicApi).parseAsync(
    ["investigation", "recordFinding", "--run-id", "run-id"],
    { from: "user" },
  );
  await registerRecordFinding(contract, callPublicApi).parseAsync(
    [
      "investigation",
      "recordFinding",
      "--run-id",
      "run-id",
      "--session-id",
      "flag-session-id",
    ],
    { from: "user" },
  );

  expect(callPublicApi).toHaveBeenNthCalledWith(1, contract, {
    runId: "run-id",
    sessionId: "environment-chat-session-id",
  });
  expect(callPublicApi).toHaveBeenNthCalledWith(2, contract, {
    runId: "run-id",
    sessionId: "flag-session-id",
  });
});
