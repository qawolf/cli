import { describe, expect, it } from "bun:test";

import {
  hashRunFile,
  toRunFilesManifest,
} from "~/core/interactiveRunner/fileDelta.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const files = {
  "flow.ts": "export default {};",
  "package.json": "{}",
  "pages/login.ts": "export const login = 1;",
};
const submitted = { outcome: "success" as const, runId: "run-a" };

function makeDeps() {
  return makeTestDeps({
    collectRunFiles: async () => ({ files, unresolvedImports: [] }),
  });
}

async function run(
  deps: ReturnType<typeof makeDeps>,
  answers: readonly unknown[] = [submitted],
) {
  const { callPublicApi, ctx } = makeAuthCtx();
  for (const answer of answers) {
    callPublicApi.mockResolvedValueOnce({ ok: true, value: answer });
  }
  const result = await handleRunnerRun(
    ctx,
    {
      entryPoint: "flow.ts",
      envFile: undefined,
      envId: undefined,
      follow: false,
      lines: undefined,
      linesFile: undefined,
      logs: false,
      recorderEvents: false,
      runEvents: false,
      runner: "ci",
      timeout: undefined,
    },
    deps,
  );
  return { callPublicApi, ctx, result };
}

const requestAt = (
  callPublicApi: ReturnType<typeof makeAuthCtx>["callPublicApi"],
  index: number,
): Record<string, unknown> => {
  const request = callPublicApi.mock.calls[index]?.[1];
  if (request === null || typeof request !== "object") return {};
  return Object.fromEntries(Object.entries(request));
};

describe("handleRunnerRun file delta", () => {
  it("sends every file when the directory holds no baseline", async () => {
    const { callPublicApi, result } = await run(makeDeps());

    expect(result).toBeUndefined();
    expect(requestAt(callPublicApi, 0)["unchangedFiles"]).toBeUndefined();
  });

  it("records what it sent, so the next run can send less", async () => {
    const deps = makeDeps();

    await run(deps);

    expect(await deps.runFilesManifest.read()).toEqual(
      toRunFilesManifest({ files, runnerId: "ci" }),
    );
  });

  it("sends only what changed once a baseline exists", async () => {
    const deps = makeDeps();
    await deps.runFilesManifest.write(
      toRunFilesManifest({ files, runnerId: "ci" }),
    );

    const { callPublicApi } = await run(deps);

    const request = requestAt(callPublicApi, 0);
    expect(request["unchangedFiles"]).toEqual({
      "pages/login.ts": hashRunFile(files["pages/login.ts"]),
    });
    expect(Object.keys(request["files"] ?? {}).sort()).toEqual([
      "flow.ts",
      "package.json",
    ]);
  });

  it("says on stdout which way the files went", async () => {
    const deps = makeDeps();
    await deps.runFilesManifest.write(
      toRunFilesManifest({ files, runnerId: "ci" }),
    );

    const { ctx } = await run(deps);

    expect(ctx.ui.output).toHaveBeenCalledWith(
      expect.objectContaining({ fileSync: "delta" }),
      expect.any(String),
    );
  });

  it("ignores a baseline another runner left behind", async () => {
    const deps = makeDeps();
    await deps.runFilesManifest.write(
      toRunFilesManifest({ files, runnerId: "other" }),
    );

    const { callPublicApi } = await run(deps);

    expect(requestAt(callPublicApi, 0)["unchangedFiles"]).toBeUndefined();
  });

  it("resends everything once when the runner does not hold what was claimed", async () => {
    const deps = makeDeps();
    await deps.runFilesManifest.write(
      toRunFilesManifest({ files, runnerId: "ci" }),
    );

    const { callPublicApi, result } = await run(deps, [
      {
        failureReason: "needs-full-sync",
        missingPaths: ["pages/login.ts"],
        outcome: "failure",
      },
      submitted,
    ]);

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledTimes(2);
    expect(requestAt(callPublicApi, 1)["unchangedFiles"]).toBeUndefined();
    expect(
      Object.keys(requestAt(callPublicApi, 1)["files"] ?? {}),
    ).toHaveLength(3);
  });

  it("reports rather than looping when a full request is refused the same way", async () => {
    const deps = makeDeps();
    await deps.runFilesManifest.write(
      toRunFilesManifest({ files, runnerId: "ci" }),
    );
    const refusal = {
      failureReason: "needs-full-sync",
      missingPaths: ["pages/login.ts"],
      outcome: "failure",
    };

    const { callPublicApi, result } = await run(deps, [refusal, refusal]);

    expect(callPublicApi).toHaveBeenCalledTimes(2);
    expect(result?.exitCode).toBe(4);
  });

  it("claims no baseline when the submission failed", async () => {
    const deps = makeDeps();
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    await handleRunnerRun(
      ctx,
      {
        entryPoint: "flow.ts",
        envFile: undefined,
        envId: undefined,
        follow: false,
        lines: undefined,
        linesFile: undefined,
        logs: false,
        recorderEvents: false,
        runEvents: false,
        runner: "ci",
        timeout: undefined,
      },
      deps,
    );

    expect(await deps.runFilesManifest.read()).toBeUndefined();
  });
});
