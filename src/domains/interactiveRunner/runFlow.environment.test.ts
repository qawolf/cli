import { basename } from "node:path";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const submitted = { outcome: "success" as const, runId: "run-a" };

describe("handleRunnerRun with --env-file", () => {
  const envFileDeps = (content: string) =>
    makeTestDeps({
      collectRunFiles: async () => ({
        "flow.ts": "export default {};",
        "package.json": "{}",
      }),
      readFile: async (path) => {
        if (basename(path) === ".env") return content;
        throw Error(`no such file: ${path}`);
      },
    });

  const run = async (envFile: string | undefined, content = 'A="1"\n') => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: submitted });
    const result = await handleRunnerRun(
      ctx,
      {
        entryPoint: "flow.ts",
        envFile,
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

  it("sends the file's variables as the run's environment", async () => {
    const { callPublicApi, result } = await run(".env");

    expect(result).toBeUndefined();
    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      env: { A: "1" },
    });
  });

  it("sends no environment when no file is named", async () => {
    const { callPublicApi } = await run(undefined);

    expect(Object.hasOwn(callPublicApi.mock.calls[0]?.[1] ?? {}, "env")).toBe(
      false,
    );
  });

  it("reports a file it cannot read before addressing a runner", async () => {
    const { callPublicApi, result } = await run("missing.env");

    expect(result?.error).toContain("missing.env");
    expect(result?.exitCode).toBe(5);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a variable the contract will not take", async () => {
    const { callPublicApi, result } = await run(".env", 'QAWOLF_TEAM_ID="t"\n');

    expect(result?.exitCode).toBe(5);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
