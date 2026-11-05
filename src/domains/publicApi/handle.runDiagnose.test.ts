import { afterEach, describe, expect, it, mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { buildCommandSpecs, type CommandSpec } from "./commandSpecs.js";
import { handlePublicApiCommand } from "./handle.js";
import { ctxWith } from "./handle.testUtils.js";

const runDiagnoseSpec = (): CommandSpec => {
  const spec = buildCommandSpecs({
    run: { diagnose: publicContractsV1.run.diagnose },
  }).find((candidate) => candidate.trpcPath === "public.run.diagnose");
  if (!spec) throw new Error("run.diagnose spec missing");
  return spec;
};

afterEach(() => {
  mock.restore();
});

describe("run diagnose", () => {
  it("requires only --issue-id and --run-id as flags", () => {
    expect(
      runDiagnoseSpec()
        .flags.filter((flag) => flag.required)
        .map((flag) => flag.flag),
    ).toEqual(["--issue-id <value>", "--run-id <value>"]);
  });

  it("refuses locally and sends nothing without --failures or --flow-ids", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runDiagnoseSpec(), {
      issueId: "issue-id",
      runId: "run-id",
    });

    expect(result?.error).toContain(
      "At least one of failures or flowIds is required.",
    );
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("sends only failures, issueId and runId for --failures", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { issue: {} },
    });
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, runDiagnoseSpec(), {
      failures: ["a:0", "a:2"],
      issueId: "issue-id",
      runId: "run-id",
    });

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    const [contract, input] = callPublicApi.mock.calls[0] ?? [];
    expect(contract).toBe(publicContractsV1.run.diagnose);
    expect(input).toStrictEqual({
      failures: ["a:0", "a:2"],
      issueId: "issue-id",
      runId: "run-id",
    });
  });
});
