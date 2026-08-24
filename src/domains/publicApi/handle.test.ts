import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { handlePublicApiCommand } from "./handle.js";
import { countSpec, ctxWith, runCreateSpec } from "./handle.testUtils.js";

afterEach(() => {
  mock.restore();
});

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
      tagNames: [],
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

  it("carries the platform failure's exit code into the command result", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: false,
      error: "QA Wolf API rejected the run.create request (HTTP 401).",
      exitCode: 3,
    });
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({
      error: "QA Wolf API rejected the run.create request (HTTP 401).",
      exitCode: 3,
    });
  });

  it("passes the server's reason through as the error body", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: false,
      error: "QA Wolf API run.create request failed (HTTP 400).",
      errorBody: "environmentId does not belong to your team.",
    });
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runCreateSpec(), {
      environmentId: "environment-id",
      flowIds: ["flow-id"],
    });

    expect(result).toEqual({
      error: "QA Wolf API run.create request failed (HTTP 400).",
      errorBody: "environmentId does not belong to your team.",
    });
  });
});
