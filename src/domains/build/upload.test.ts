import { describe, expect, it } from "bun:test";

import { makeAuthCtx } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";

import { handleBuildUpload } from "./upload.js";
import {
  baseOptions,
  buildId,
  created,
  makeDeps,
  requested,
} from "./upload.testUtils.js";

describe("handleBuildUpload", () => {
  it("requests a URL for the file, PUTs it there, then creates the build", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(requested)
      .mockResolvedValueOnce(created);
    const file = new Blob(["apk bytes"]);
    const deps = makeDeps(file);

    const result = await handleBuildUpload(ctx, baseOptions, deps);

    expect(result).toBeUndefined();
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      fileName: "app-release.apk",
      fileSizeBytes: 9,
    });
    expect(deps.putFile.mock.calls[0]?.[0]).toEqual({
      body: file,
      headers: requested.value.uploadHeaders,
      url: requested.value.uploadUrl,
    });
    expect(callPublicApi.mock.calls[1]?.[1]).toEqual({ buildId });
    expect(outputs()).toEqual([
      {
        data: created.value.build,
        humanMessage: `Build ${buildId} (com.example.app, android 1.2.3) uploaded: https://app.qawolf.com/acme/builds`,
      },
    ]);
  });

  it("puts the build on the environment, branch and commit it was given", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce(requested)
      .mockResolvedValueOnce(created);

    await handleBuildUpload(
      ctx,
      {
        ...baseOptions,
        branch: "main",
        commitSha: "abc123",
        environmentBaseEphemeralEnvironment: "staging",
        environmentEphemeral: true,
        environmentName: "pr-42",
        workspaceId: "ws_1",
      },
      makeDeps(),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      workspaceId: "ws_1",
    });
    expect(callPublicApi.mock.calls[1]?.[1]).toEqual({
      branch: "main",
      buildId,
      commitSha: "abc123",
      environment: {
        baseEphemeralEnvironment: "staging",
        ephemeral: true,
        name: "pr-42",
      },
      workspaceId: "ws_1",
    });
  });

  it("refuses an environment named both by id and by name before uploading", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleBuildUpload(
      ctx,
      { ...baseOptions, environmentId: "env_1", environmentName: "staging" },
      makeDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain("either { id } or { name }");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a file that is not an app build before uploading", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleBuildUpload(
      ctx,
      { ...baseOptions, filePath: "notes.txt" },
      makeDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(result?.error).toContain(".apk, .aab or .ipa");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a path that is not a readable file", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleBuildUpload(
      ctx,
      baseOptions,
      makeDeps("unreadable"),
    );

    expect(result).toEqual({
      error: "dist/app-release.apk is not a readable file.",
      exitCode: exitCodes.invalidArgs,
    });
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
