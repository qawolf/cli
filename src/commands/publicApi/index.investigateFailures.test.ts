import { afterEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

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

describe("run create --no-investigate-failures", () => {
  it("sends investigateFailures false only when --no-investigate-failures is given", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { runId: "run-id" },
    });
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
    });

    await program.parseAsync(
      [
        "run",
        "create",
        "--environment-id",
        "environment-id",
        "--flow-ids",
        "flow-id",
        "--no-investigate-failures",
      ],
      { from: "user" },
    );

    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.run.create, {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
      ignoreRules: false,
      investigateFailures: false,
      tagNames: [],
    });
  });
});
