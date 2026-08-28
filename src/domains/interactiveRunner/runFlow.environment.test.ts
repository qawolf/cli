import { basename } from "node:path";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const submitted = { outcome: "success" as const, runId: "run-a" };

describe("handleRunnerRun with --env-file and --env-id", () => {
  const envFileDeps = (content: string) =>
    makeTestDeps({
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
    envFile,
    envId,
  }: {
    content?: string;
    envFile?: string;
    envId?: string;
  }) => {
    const { callPublicApi, ctx } = makeAuthCtx();
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
      envFileDeps(content),
    );
    return { callPublicApi, result };
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
