import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Command } from "commander";
import { z } from "zod";

import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";

// `process.exitCode` is global state and persists across tests; reset to 0
// (not undefined — bun ignores an undefined assignment) so leftover state
// cannot leak into these tests or out to other test files (bun's runner
// reads exitCode at process exit).
beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = 0;
});

// Exercises the whole flag round-trip through a real Commander parse: the
// CLI derives each option key from the contract path while Commander derives
// it from the kebab-cased flag string, and the two must agree for nested
// input to reassemble. Unit tests hand Commander's output to assembleInput,
// so only this test would catch the derivations drifting apart.
const contract = {
  name: "fake.reportStatus",
  kind: "write" as const,
  description: "Synthetic nested contract.",
  input: z.object({
    environment: z.union([
      z.strictObject({ id: z.string() }),
      z.strictObject({ name: z.string() }),
    ]),
    externalId: z.string(),
    metadata: z.object({ commitSha: z.string() }).optional(),
    settings: z.object({ verbose: z.boolean().optional() }).optional(),
  }),
  output: z.object({ ok: z.boolean() }),
};

function registerWith(
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>,
): Command {
  const program = new Command().name("qawolf").exitOverride();
  registerPublicApiCommands(program, createSignalRegistry(), {
    contracts: { fake: { reportStatus: contract } },
    authDeps: {
      requireApiKey: async () => ({ key: "qawolf_key", source: "env" }),
      createPlatform: () => makeMockPlatformClient({ callPublicApi }),
    },
  });
  return program;
}

describe("registerPublicApiCommands nested inputs", () => {
  it("reassembles nested input from real argv", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { ok: true },
    });

    await registerWith(callPublicApi).parseAsync(
      [
        "fake",
        "reportStatus",
        "--environment-name",
        "preview-42",
        "--external-id",
        "vercel_dpl_123",
        "--metadata-commit-sha",
        "abc123",
        "--settings-verbose",
      ],
      { from: "user" },
    );

    expect(callPublicApi).toHaveBeenCalledWith(contract, {
      environment: { name: "preview-42" },
      externalId: "vercel_dpl_123",
      metadata: { commitSha: "abc123" },
      settings: { verbose: true },
    });
  });

  it("rejects flags from two union branches before any request", async () => {
    const callPublicApi = makeCallPublicApiMock();

    await registerWith(callPublicApi).parseAsync(
      [
        "fake",
        "reportStatus",
        "--environment-id",
        "env-1",
        "--environment-name",
        "preview-42",
        "--external-id",
        "vercel_dpl_123",
      ],
      { from: "user" },
    );

    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
