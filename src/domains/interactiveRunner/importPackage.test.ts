import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerImportPackage } from "./importPackage.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const manifest = JSON.stringify({
  dependencies: { "@qawolf/flows": "workspace:*", zod: "4.4.3" },
  devDependencies: { typescript: "6.0.3" },
});

function depsWithManifest(content = manifest) {
  return makeTestDeps({
    collectRunFiles: async () => ({ "package.json": content }),
    readFile: async () => content,
  });
}

describe("handleRunnerImportPackage", () => {
  it("installs a version the caller named, against the project's dependencies", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success" },
    });

    expect(
      await handleRunnerImportPackage(
        ctx,
        { name: "dayjs", runner: "ci", version: "1.11.13" },
        depsWithManifest(),
      ),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.importPackage,
      {
        id: "ci",
        npmDependencies: { typescript: "6.0.3", zod: "4.4.3" },
        packageName: "dayjs",
        packageVersion: "1.11.13",
      },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toContain("dayjs@1.11.13");
  });

  it("asks npm for latest when no version is named", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success" },
    });

    await handleRunnerImportPackage(
      ctx,
      { name: "dayjs", runner: "ci", version: undefined },
      depsWithManifest(),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      packageVersion: "latest",
    });
  });

  it("reports a directory with no package.json rather than installing blind", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps({
      readFile: () => Promise.reject(Error("ENOENT")),
    });

    const result = await handleRunnerImportPackage(
      ctx,
      { name: "dayjs", runner: "ci", version: undefined },
      deps,
    );

    expect(result?.error).toContain("No package.json");
    expect(result?.exitCode).toBe(5);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("names what is wrong with a package.json it cannot read", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerImportPackage(
      ctx,
      { name: "dayjs", runner: "ci", version: undefined },
      depsWithManifest("{ not json"),
    );

    expect(result?.error).toContain("not valid JSON");
    expect(result?.exitCode).toBe(5);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("never launches a runner, and says an install needs a live run", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerImportPackage(
      ctx,
      { name: "dayjs", runner: undefined, version: undefined },
      depsWithManifest(),
    );

    expect(result?.error).toContain("qawolf runner run");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("passes on npm's reason for refusing the install", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "No matching version found for dayjs@99.0.0",
        failureReason: "install-failed",
        outcome: "failure",
      },
    });

    const result = await handleRunnerImportPackage(
      ctx,
      { name: "dayjs", runner: "ci", version: "99.0.0" },
      depsWithManifest(),
    );

    expect(result?.error).toContain("No matching version found");
    expect(result?.exitCode).toBe(2);
  });

  it("reads an unreachable runner as worth retrying", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerImportPackage(
      ctx,
      { name: "dayjs", runner: "ci", version: undefined },
      depsWithManifest(),
    );

    expect(result?.error).toContain("Retry");
    expect(result?.exitCode).toBe(4);
  });
});
