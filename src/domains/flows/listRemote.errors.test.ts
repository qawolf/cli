import { afterEach, describe, expect, it, mock } from "bun:test";

import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeCtx as makeBaseCtx } from "~/shell/commandContext.testUtils.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import type { UI } from "~/shell/ui/index.js";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { flowsListRemote, type FlowsListRemoteOptions } from "./listRemote.js";

afterEach(() => {
  mock.restore();
});

const options: FlowsListRemoteOptions = {
  aiTaskId: undefined,
  env: "environment-id",
  includeDrafts: false,
  tags: [],
};

async function runWithFailure(
  failure: Extract<PlatformResult<never>, { ok: false }>,
): Promise<{ ui: UI; result: unknown }> {
  const ui = makeFakeUI();
  const ctx: AuthCommandContext = {
    ...makeBaseCtx("human"),
    ui: { ...ui, mode: "human" },
    apiKeySource: "env",
    platformClient: makeMockPlatformClient({
      callPublicApi: makeCallPublicApiMock().mockResolvedValue(failure),
    }),
  };
  const result = await flowsListRemote(ctx, undefined, options);
  return { ui, result };
}

describe("flowsListRemote platform error", () => {
  it("returns a CommandResult with the platform error message", async () => {
    const { ui, result } = await runWithFailure({
      ok: false,
      error: "QA Wolf API rejected the flow.list request (HTTP 401).",
    });

    expect(result).toEqual({
      error: "QA Wolf API rejected the flow.list request (HTTP 401).",
    });
    expect(ui.write).not.toHaveBeenCalled();
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("passes the server's reason through as the error body", async () => {
    const { result } = await runWithFailure({
      ok: false,
      error: "QA Wolf API flow.list request failed (HTTP 400).",
      errorBody: "environmentId does not belong to your team.",
    });

    expect(result).toEqual({
      error: "QA Wolf API flow.list request failed (HTTP 400).",
      errorBody: "environmentId does not belong to your team.",
    });
  });
});
