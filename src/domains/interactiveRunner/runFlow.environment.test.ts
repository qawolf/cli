import { basename } from "node:path";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const submitted = { outcome: "success" as const, runId: "run-a" };

describe("handleRunnerRun with --env-file and --env-id", () => {
  const envFileDeps = (content: string, env: Record<string, string> = {}) =>
    makeTestDeps({
      env,
      collectRunFiles: async () => ({
        files: {
          "flow.ts": "export default {};",
          "package.json": "{}",
        },
        unresolvedImports: [],
      }),
      readFile: async (path) => {
        if (basename(path) === ".env") return content;
        throw Error(`no such file: ${path}`);
      },
    });

  const run = async ({
    content = 'A="1"\n',
    env,
    envFile,
    envId,
  }: {
    content?: string;
    env?: Record<string, string>;
    envFile?: string;
    envId?: string;
  }) => {
    const { callPublicApi, ctx, infos } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: submitted });
    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flow.ts",
        envFile,
        envId,
        follow: false,
        lines: undefined,
        linesFile: undefined,
        logs: false,
        recorderEvents: false,
        runEvents: false,
        runner: "ci",
        timeout: undefined,
      },
      envFileDeps(content, env),
    );
    return { callPublicApi, infos, result };
  };

  const sentRequest = (callPublicApi: { mock: { calls: unknown[][] } }) =>
    callPublicApi.mock.calls[0]?.[1] ?? {};

  it("sends the file's variables as the run's environment", async () => {
    const { callPublicApi, result } = await run({ envFile: ".env" });

    expect(result).toBeUndefined();
    expect(sentRequest(callPublicApi)).toMatchObject({ env: { A: "1" } });
  });

  it("sends no environment when neither flag is passed", async () => {
    const { callPublicApi } = await run({});
    const request = sentRequest(callPublicApi);

    expect(Object.hasOwn(request, "env")).toBe(false);
    expect(Object.hasOwn(request, "environmentId")).toBe(false);
  });

  it("reports a file it cannot read before addressing a runner", async () => {
    const { callPublicApi, result } = await run({ envFile: "missing.env" });

    expect(result?.error).toContain("missing.env");
    expect(result?.exitCode).toBe(5);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a variable the contract will not take", async () => {
    const { callPublicApi, result } = await run({
      content: 'QAWOLF_TEAM_ID="t"\n',
      envFile: ".env",
    });

    expect(result?.exitCode).toBe(5);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("names a QA Wolf environment instead of sending variables", async () => {
    const { callPublicApi, result } = await run({ envId: "staging" });
    const request = sentRequest(callPublicApi);

    expect(result).toBeUndefined();
    expect(request).toMatchObject({ environmentId: "staging" });
    expect(Object.hasOwn(request, "env")).toBe(false);
  });

  it("trims the environment it was given", async () => {
    const { callPublicApi } = await run({ envId: "  staging  " });

    expect(sentRequest(callPublicApi)).toMatchObject({
      environmentId: "staging",
    });
  });

  it("falls back to QAWOLF_ENVIRONMENT when neither flag is passed", async () => {
    const { callPublicApi, infos, result } = await run({
      env: { QAWOLF_ENVIRONMENT: "staging" },
    });

    expect(result).toBeUndefined();
    expect(sentRequest(callPublicApi)).toMatchObject({
      environmentId: "staging",
    });
    // Those variables reach the flow's code, so the run says where they came from.
    expect(infos().join("\n")).toContain("QAWOLF_ENVIRONMENT");
  });

  it("prefers an explicit --env-id over QAWOLF_ENVIRONMENT", async () => {
    const { callPublicApi, infos } = await run({
      env: { QAWOLF_ENVIRONMENT: "staging" },
      envId: "production",
    });

    expect(sentRequest(callPublicApi)).toMatchObject({
      environmentId: "production",
    });
    expect(infos().join("\n")).not.toContain("QAWOLF_ENVIRONMENT");
  });

  // The file is the whole environment the caller asked for, so it is not given
  // a second one on top.
  it("ignores QAWOLF_ENVIRONMENT when --env-file is passed", async () => {
    const { callPublicApi } = await run({
      env: { QAWOLF_ENVIRONMENT: "staging" },
      envFile: ".env",
    });
    const request = sentRequest(callPublicApi);

    expect(request).toMatchObject({ env: { A: "1" } });
    expect(Object.hasOwn(request, "environmentId")).toBe(false);
  });

  it("treats a blank QAWOLF_ENVIRONMENT as unset", async () => {
    const { callPublicApi } = await run({ env: { QAWOLF_ENVIRONMENT: "  " } });

    expect(Object.hasOwn(sentRequest(callPublicApi), "environmentId")).toBe(
      false,
    );
  });

  it("refuses an --env-id given nothing", async () => {
    const { callPublicApi, result } = await run({ envId: "  " });

    expect(result?.error).toContain("--env-id was given nothing");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses both flags together before addressing a runner", async () => {
    const { callPublicApi, result } = await run({
      envFile: ".env",
      envId: "staging",
    });

    expect(result?.error).toContain("--env-id and --env-file");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
