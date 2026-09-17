import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerEvents } from "./events.js";
import { handleRunnerScreenshot } from "./takeScreenshot.js";

// What the platform layer builds from a 404 on a runner route, which is what a
// handler sees.
const notRunning = {
  error: "Runner ci is not running (HTTP 404).",
  errorBody: "It was never launched, or it has since been terminated.",
  exitCode: exitCodes.notFound,
  ok: false as const,
};

const eventsOptions = {
  envelope: false,
  follow: false,
  run: undefined,
  since: undefined,
  stream: "run-status",
  tail: undefined,
  timeout: "60",
};

describe("a runner-targeting command whose runner is gone", () => {
  it("names the runner and does not send the caller to --env", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(notRunning);

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.error).toBe(notRunning.error);
    expect(result?.error).not.toContain("--env");
  });

  // Exit 4 reads as "retry", and the published guidance says to. A terminated
  // runner never comes back, so a caller that retries it burns its budget.
  it("exits not-found rather than network", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(notRunning);

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.notFound);
  });

  it.each([
    ["--runner", { runner: "ci" }, {}, "The id ci came from --runner."],
    [
      "QAWOLF_RUNNER_ID",
      { runner: undefined },
      { env: { QAWOLF_RUNNER_ID: "ci" } },
      "The id ci came from QAWOLF_RUNNER_ID.",
    ],
  ] as const)(
    "says the id came from %s",
    async (_name, options, deps, line) => {
      const { callPublicApi, ctx } = makeAuthCtx();
      callPublicApi.mockResolvedValue(notRunning);

      const result = await handleRunnerScreenshot(
        ctx,
        { out: "shot.jpg", ...options },
        makeTestDeps(deps),
      );

      expect(result?.errorBody).toContain(line);
    },
  );

  it("says the id came from the directory's stored default", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(notRunning);
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("ci");

    const result = await handleRunnerScreenshot(
      ctx,
      { out: "shot.jpg", runner: undefined },
      deps,
    );

    expect(result?.errorBody).toContain(".qawolf");
  });

  // A journal read goes through its own result type, so it has to carry the
  // same answer rather than collapsing back to a network failure.
  it("answers a journal read the same way", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(notRunning);

    const result = await handleRunnerEvents(
      ctx,
      { ...eventsOptions, runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.notFound);
    expect(result?.errorBody).toContain("The id ci came from --runner.");
  });
});
