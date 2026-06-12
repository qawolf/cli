import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx, makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import type { UI } from "~/shell/ui/index.js";

import { buildCommandSpecs, type CommandSpec } from "./commandSpecs.js";
import { handlePublicApiCommand } from "./handle.js";

afterEach(() => {
  mock.restore();
});

const runCreateSpec = (): CommandSpec => {
  const spec = buildCommandSpecs({
    run: { create: publicContractsV1.run.create },
  }).find((candidate) => candidate.trpcPath === "public.run.create");
  if (!spec) throw new Error("run.create spec missing");
  return spec;
};

// Synthetic contract exercising the number flag kind, which no real public
// contract uses yet.
const countSpec = (): CommandSpec => {
  const contract = {
    name: "fake.count",
    kind: "write" as const,
    description: "synthetic number-flag contract",
    input: z.object({ count: z.number() }),
    output: z.object({ ok: z.boolean() }),
  };
  const spec = buildCommandSpecs({ fake: { count: contract } }).find(
    (candidate) => candidate.trpcPath === "public.fake.count",
  );
  if (!spec) throw new Error("fake.count spec missing");
  return spec;
};

function ctxWith(ui: UI, platform: PlatformClient): AuthCommandContext {
  return {
    ...makeCtx("human"),
    ui,
    apiKeySource: "env",
    platform,
  };
}

describe("handlePublicApiCommand", () => {
  it("assembles the input, calls the contract, and outputs the result", async () => {
    const environmentId = "environment-id";
    const flowId = "flow-id";
    const runId = "run-id";
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { runId },
    });
    const ui = makeFakeUI();
    const ctx = ctxWith(ui, makeMockPlatformClient({ callPublicApi }));

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId,
      environmentVariables: ["FOO=bar", "BAZ=qux=quux"],
      flowIds: [flowId],
    });

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.run.create, {
      environmentId,
      environmentVariables: { BAZ: "qux=quux", FOO: "bar" },
      flowIds: [flowId],
      ignoreRules: false,
    });
    expect(ui.output).toHaveBeenCalledTimes(1);
    const [data, humanMessage] = (ui.output as ReturnType<typeof mock>).mock
      .calls[0] as [unknown, string];
    expect(data).toEqual({ runId });
    expect(humanMessage).toContain(runId);
  });

  it("rejects malformed KEY=VALUE pairs before calling the platform", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId: "environment-id",
      environmentVariables: ["MISSING_SEPARATOR"],
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({
      error:
        'Invalid --environment-variables value "MISSING_SEPARATOR": expected KEY=VALUE.',
    });
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("rejects a non-array key-value-record value before calling the platform", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId: "environment-id",
      environmentVariables: "FOO=bar",
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({
      error: "Invalid --environment-variables value: expected KEY=VALUE pairs.",
    });
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("parses number flag values before calling the platform", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { ok: true },
    });
    const spec = countSpec();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, spec, { count: "5" });

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, { count: 5 });
  });

  it("passes an empty number flag value through as 0 (Number('') coercion)", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { ok: true },
    });
    const spec = countSpec();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, spec, { count: "" });

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, { count: 0 });
  });

  it("rejects a non-numeric number flag value before calling the platform", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, countSpec(), {
      count: "abc",
    });

    expect(result).toBeDefined();
    if (!result) return;
    expect(result.error).toContain("count");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("rejects input that fails contract validation before calling the platform", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId: "",
      flowIds: ["flow-id"],
    });

    expect(result).toBeDefined();
    if (!result) return;
    expect(result.error).toContain("environmentId");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("surfaces platform errors as the command result", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: false,
      error: "run.create failed (500).",
    });
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({ error: "run.create failed (500)." });
  });
});
