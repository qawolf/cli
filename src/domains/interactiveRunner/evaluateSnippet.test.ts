import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerExec } from "./evaluateSnippet.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const evaluated = { outcome: "evaluated" as const, result: "success" as const };

describe("handleRunnerExec", () => {
  it("sends the code read from a file, carrying nothing of the project", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: evaluated });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.evaluateSnippet,
      { code: "export default {};", id: "ci" },
      runnerCallOptions,
    );
  });

  it("reads the snippet from stdin when given -", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: evaluated });

    await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "-" },
      makeTestDeps({
        readStdin: async () => "console.log(await page.title())",
      }),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      code: "console.log(await page.title())",
    });
  });

  // A runner holds no copy of the project, so a snippet's scope travels with it.
  it("ships the named file's scope when --file is given", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: evaluated });

    await handleRunnerExec(
      ctx,
      { contextFile: "flow.ts", runner: "ci", source: "-" },
      makeTestDeps({ readStdin: async () => "await signIn()" }),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      code: "await signIn()",
      filePath: "flow.ts",
      files: {
        "flow.ts": "export default {};",
        "package.json": "{}",
      },
      id: "ci",
    });
  });

  // Unlike a run, a snippet installs nothing, so demanding a package.json would
  // refuse requests the server would have accepted.
  it("does not demand a package.json", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: evaluated });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: "flow.ts", runner: "ci", source: "-" },
      makeTestDeps({
        collectRunFiles: async () => ({ "flow.ts": "export default {};" }),
        readStdin: async () => "await signIn()",
      }),
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalled();
  });

  it("refuses a context file that does not travel, without a request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerExec(
      ctx,
      { contextFile: "missing.ts", runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("missing.ts");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a file that holds no code, naming it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "blank.ts" },
      makeTestDeps({ readFile: async () => "  \n" }),
    );

    expect(result?.error).toContain("blank.ts");
    expect(result?.error).toContain("no code to evaluate");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses an empty stdin, pointing at a file instead", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "-" },
      makeTestDeps({ readStdin: async () => "" }),
    );

    expect(result?.error).toContain("Nothing arrived on stdin");
    expect(result?.error).toContain("name a file");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("says so when the snippet file cannot be read", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "nowhere.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("nowhere.ts");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // The contract answers whether it ran, never what it evaluated to, so nothing
  // here may read as handing a value back.
  it("points at the console stream rather than implying a returned value", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: evaluated });

    await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    const message = outputs()[0]?.humanMessage ?? "";
    expect(message).toContain("Its value is not returned");
    expect(message).toContain("qawolf runner events console");
  });

  it("reports a snippet that threw, with its message", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "page.click: no such element",
        outcome: "evaluated",
        result: "error",
      },
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("page.click: no such element");
    expect(result?.exitCode).toBe(1);
  });

  it("reports a snippet that was interrupted", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "evaluated", result: "stopped" },
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("interrupted");
    expect(result?.exitCode).toBe(1);
  });

  // The handler rebuilds resolveRunner's failure as its own result, and the
  // server's reason has to survive that rebuild too.
  it("passes on the reason the server gave for refusing the auto-launch", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "QA Wolf API runner.launch request failed (HTTP 409).",
      errorBody: "Runner quota reached: 5 of 5 runners are already running.",
      ok: false,
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: undefined, source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.errorBody).toContain("quota reached");
    expect(result?.exitCode).toBe(4);
  });

  // For this verb, unreachable also covers a runner with no live page, which will
  // never clear, so the message has to name that rather than just say "retry".
  it("names the no-live-page case an unreachable answer hides", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("no live page");
    // A fresh playwright runner does run a browser, so telling the
    // caller to check the image would send them after the wrong thing.
    expect(result?.error).toContain("run a flow on it with qawolf runner run");
    expect(result?.error).toContain("not proof the snippet did not run");
    expect(result?.exitCode).toBe(4);
  });
});
