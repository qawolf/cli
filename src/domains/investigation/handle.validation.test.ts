import { describe, expect, it } from "bun:test";

import { makeAuthCtx } from "~/shell/commandContext.testUtils.js";
import { handleInvestigationInspect, type InspectOptions } from "./handle.js";

const base: InspectOptions = {
  attemptId: "attempt-1",
  format: "text",
  limit: "20",
  type: "network",
};

async function inspectError(options: Partial<InspectOptions>) {
  const { callPublicApi, ctx } = makeAuthCtx("json");
  const result = await handleInvestigationInspect(ctx, {
    ...base,
    ...options,
  });
  expect(callPublicApi).not.toHaveBeenCalled();
  return result;
}

describe("investigation inspect flag validation", () => {
  it("rejects a --limit above 100 before calling the API", async () => {
    expect(await inspectError({ limit: "101" })).toEqual({
      error: "--limit must be at most 100, got 101.",
    });
  });

  it.each([
    ["startTimestamp", "--start-timestamp"],
    ["endTimestamp", "--end-timestamp"],
  ] as const)(
    "rejects an unparseable %s before calling the API",
    async (field, flag) => {
      expect(await inspectError({ [field]: "yesterday", type: "log" })).toEqual(
        {
          error: `Invalid ${flag}: yesterday. Use an ISO 8601 timestamp such as 2026-01-31T12:00:00Z.`,
        },
      );
    },
  );
});
