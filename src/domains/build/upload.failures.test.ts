import { describe, expect, it } from "bun:test";

import { makeAuthCtx } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";

import { handleBuildUpload } from "./upload.js";
import {
  baseOptions,
  buildId,
  makeDeps,
  requested,
} from "./upload.testUtils.js";

describe("handleBuildUpload failures", () => {
  it("stops when no upload URL is given, with the platform's reason and the generated commands' exit code", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValueOnce({
      ok: false,
      error: "QA Wolf API request failed (HTTP 400).",
      errorBody: "Builds are not enabled for this workspace.",
    });
    const deps = makeDeps();

    const result = await handleBuildUpload(ctx, baseOptions, deps);

    expect(result).toEqual({
      error: "QA Wolf API request failed (HTTP 400).",
      errorBody: "Builds are not enabled for this workspace.",
    });
    expect(deps.putFile).not.toHaveBeenCalled();
  });

  it("stops when storage refuses the file, and does not create the build", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValueOnce(requested);
    const deps = makeDeps();
    deps.putFile.mockResolvedValueOnce({
      ok: false,
      error: { body: "", kind: "http", status: 412 },
    });

    const result = await handleBuildUpload(ctx, baseOptions, deps);

    expect(result).toEqual({
      error: `The upload of build ${buildId} failed: storage refused it (HTTP 412). Run qawolf build upload again: it creates a new build.`,
      exitCode: exitCodes.network,
    });
    expect(callPublicApi).toHaveBeenCalledTimes(1);
  });

  it("shows the code and message storage refused the file with", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValueOnce(requested);
    const deps = makeDeps();
    deps.putFile.mockResolvedValueOnce({
      ok: false,
      error: {
        body: "<?xml version='1.0'?><Error><Code>ExpiredToken</Code><Message>The provided token has expired.</Message></Error>",
        kind: "http",
        status: 400,
      },
    });

    const result = await handleBuildUpload(ctx, baseOptions, deps);

    expect(result?.error).toContain(
      "storage refused it (HTTP 400: ExpiredToken: The provided token has expired.)",
    );
  });

  it("names the cause when storage cannot be reached", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValueOnce(requested);
    const deps = makeDeps();
    deps.putFile.mockResolvedValueOnce({
      ok: false,
      error: { cause: new Error("socket hang up"), kind: "network" },
    });

    const result = await handleBuildUpload(ctx, baseOptions, deps);

    expect(result?.error).toContain("could not reach storage");
    expect(result?.exitCode).toBe(exitCodes.network);
  });

  it("refuses a base environment without --environment-ephemeral before anything is sent", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeDeps();

    const result = await handleBuildUpload(
      ctx,
      {
        ...baseOptions,
        environmentBaseEphemeralEnvironment: "staging",
        environmentName: "pr-42",
      },
      deps,
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain(
      "baseEphemeralEnvironment is only valid with ephemeral",
    );
    expect(deps.putFile).not.toHaveBeenCalled();
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("says how to finish the build when it is uploaded but not created", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValueOnce(requested).mockResolvedValueOnce({
      ok: false,
      error: "QA Wolf API request failed (HTTP 503).",
    });

    const result = await handleBuildUpload(ctx, baseOptions, makeDeps());

    expect(result).toEqual({
      error: `The file is uploaded as build ${buildId}, but the build could not be created: QA Wolf API request failed (HTTP 503). If the cause was temporary, finish it with qawolf build create --build-id ${buildId} and the same environment, branch, commit and workspace flags.`,
    });
  });

  it("exits with the network code only when the platform never answered", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValueOnce(requested).mockResolvedValueOnce({
      ok: false,
      error: "Could not reach the QA Wolf API.",
      unreachable: true,
    });

    const result = await handleBuildUpload(ctx, baseOptions, makeDeps());

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toContain(`--build-id ${buildId}`);
  });
});
