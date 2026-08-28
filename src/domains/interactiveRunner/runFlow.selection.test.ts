import { describe, expect, it } from "bun:test";

import { toRunFilesManifest } from "~/core/interactiveRunner/fileDelta.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerRun } from "./runFlow.js";

const submitted = { outcome: "success" as const, runId: "run-a" };
const files = {
  "flow.ts": "export default {};",
  "package.json": "{}",
  "pages/login.ts": "export const login = () => {};",
};

async function runWith(options: {
  bootstrappedRunner?: boolean | undefined;
  entryPoint?: string;
  heldByRunner?: Record<string, string>;
  lines?: string;
  linesFile?: string;
}) {
  const { callPublicApi, ctx } = makeAuthCtx();
  callPublicApi.mockResolvedValue({
    ok: true,
    value:
      options.bootstrappedRunner === undefined
        ? submitted
        : { ...submitted, bootstrappedRunner: options.bootstrappedRunner },
  });
  const deps = makeTestDeps({
    collectRunFiles: async () => ({ files, unresolvedImports: [] }),
  });
  if (options.heldByRunner !== undefined) {
    await deps.runFilesManifest.write(
      toRunFilesManifest({ files: options.heldByRunner, runnerId: "ci" }),
    );
  }
  const result = await handleRunnerRun(
    ctx,
    {
      entryPoint: options.entryPoint ?? "flow.ts",
      follow: false,
      envFile: undefined,
      envId: undefined,
      lines: options.lines,
      linesFile: options.linesFile,
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

function requestField(options: {
  callPublicApi: ReturnType<typeof makeAuthCtx>["callPublicApi"];
  field: string;
}): unknown {
  const [request] = options.callPublicApi.mock.calls[0]?.slice(1) ?? [];
  if (request === null || typeof request !== "object") return undefined;
  return Reflect.get(request, options.field);
}

function selectionOf(
  callPublicApi: ReturnType<typeof makeAuthCtx>["callPublicApi"],
): unknown {
  return requestField({ callPublicApi, field: "selection" });
}

function filesOf(
  callPublicApi: ReturnType<typeof makeAuthCtx>["callPublicApi"],
): unknown {
  return requestField({ callPublicApi, field: "files" });
}

describe("handleRunnerRun with --lines", () => {
  it("sends the range against the flow file by default", async () => {
    const { callPublicApi, result } = await runWith({ lines: "12-40" });

    expect(result).toBeUndefined();
    expect(selectionOf(callPublicApi)).toEqual({
      endLine: 40,
      path: "flow.ts",
      startLine: 12,
    });
  });

  it("sends the range against another file when one is named", async () => {
    const { callPublicApi } = await runWith({
      lines: "4-9",
      linesFile: "pages/login.ts",
    });

    expect(selectionOf(callPublicApi)).toMatchObject({
      path: "pages/login.ts",
    });
  });

  it("sends the lines-file even when the runner already holds it unchanged", async () => {
    const { callPublicApi } = await runWith({
      heldByRunner: files,
      lines: "4-9",
      linesFile: "pages/login.ts",
    });

    expect(filesOf(callPublicApi)).toMatchObject({
      "pages/login.ts": files["pages/login.ts"],
    });
  });

  it("sends no selection when no range was asked for", async () => {
    const { callPublicApi } = await runWith({});

    expect(selectionOf(callPublicApi)).toBeUndefined();
  });

  it("refuses a lines-file that would not travel with the run", async () => {
    const { callPublicApi, result } = await runWith({
      lines: "1-2",
      linesFile: "../outside.ts",
    });

    expect(result?.error).toContain("outside.ts");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a lines-file with no range to put in it", async () => {
    const { callPublicApi, result } = await runWith({
      linesFile: "pages/login.ts",
    });

    expect(result?.error).toContain("--lines");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a malformed range before addressing a runner", async () => {
    const { callPublicApi, result } = await runWith({ lines: "twelve" });

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("says so when the runner had to be bootstrapped first", async () => {
    const { ctx } = await runWith({
      bootstrappedRunner: true,
      lines: "12-40",
    });

    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("fresh page"),
    );
  });

  it("stays quiet about a bootstrap the runner did not report", async () => {
    for (const bootstrappedRunner of [false, undefined]) {
      const { ctx } = await runWith({ bootstrappedRunner, lines: "12-40" });

      expect(ctx.ui.info).not.toHaveBeenCalledWith(
        expect.stringContaining("fresh page"),
      );
    }
  });
});
