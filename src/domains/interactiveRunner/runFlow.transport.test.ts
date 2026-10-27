import { describe, expect, it } from "bun:test";

import { handleRunnerRun } from "./runFlow.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

async function runAfterFailing(failure: {
  error: string;
  mayHaveArrived?: boolean;
}) {
  const { callPublicApi, ctx } = makeAuthCtx();
  callPublicApi.mockResolvedValue({ ok: false, ...failure });
  return handleRunnerRun(
    ctx,
    {
      builds: [],
      entryPoint: "flow.ts",
      follow: false,
      envFile: undefined,
      envId: undefined,
      lines: undefined,
      linesFile: undefined,
      runner: "ci",
      timeout: undefined,
      logs: false,
      recorderEvents: false,
      runEvents: false,
      vars: [],
    },
    makeTestDeps(),
  );
}

describe("handleRunnerRun when the submission fails on the wire", () => {
  it("says the run may have started and names the command that checks it", async () => {
    const result = await runAfterFailing({
      error:
        "Could not reach the QA Wolf API at https://app.qawolf.com to fetch runner.runFlow (UND_ERR_SOCKET: other side closed). Check your network connection and QAWOLF_HOST_URL.",
      mayHaveArrived: true,
    });

    expect(result?.error).toContain("UND_ERR_SOCKET");
    expect(result?.error).toContain("The run may have started");
    expect(result?.error).toContain("qawolf runner events run-status");
    expect(result?.exitCode).toBe(4);
  });

  it("does not suggest a started run when the platform answered with a refusal", async () => {
    const result = await runAfterFailing({
      error: "QA Wolf API runner.runFlow request failed (HTTP 400).",
    });

    expect(result?.error).not.toContain("may have started");
  });
});
