import { describe, expect, it } from "bun:test";

import { handleRunnerRun } from "./runFlow.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { makeJournal } from "./journal.testUtils.js";

const submitted = { outcome: "submitted" as const, runId: "run-a" };

const runFollowing = (
  ctx: ReturnType<typeof makeAuthCtx>["ctx"],
  options: { follow?: boolean; timeout?: string; logs?: boolean } = {},
) =>
  handleRunnerRun(
    ctx,
    {
      entryPoint: "flow.ts",
      follow: options.follow ?? true,
      runner: "ci",
      timeout: options.timeout ?? "1",
      logs: options.logs ?? false,
    },
    makeTestDeps(),
  );

describe("handleRunnerRun --follow", () => {
  it("refuses a --timeout that is not a positive number of seconds", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await runFollowing(ctx, { timeout: "0" });

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // Following puts the run's journal entries on stdout, so the submitted run goes
  // to stderr instead: two differently shaped objects on one stream would leave a
  // reader sniffing keys to tell which lines are log entries.
  it("announces the submitted run as a diagnostic when following", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({ ok: true, value: submitted })
      .mockImplementation(makeJournal({}));

    await runFollowing(ctx);

    expect(ctx.ui.info).toHaveBeenCalledWith(expect.stringContaining("run-a"));
    expect(outputs()).toEqual([]);
  });

  // --logs only chooses what a follow prints, so alone it can only mean
  // "follow, with the logs".
  it("follows when --logs is given without --follow", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi
      .mockResolvedValueOnce({ ok: true, value: submitted })
      .mockImplementation(
        makeJournal({
          "run-status": [[{ runId: "run-a", status: "passed" }]],
        }),
      );

    const result = await runFollowing(ctx, { follow: false, logs: true });

    expect(result).toBeUndefined();
    expect(ctx.ui.success).toHaveBeenCalled();
  });
});
