import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { handleAgentSend } from "./send.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const started = {
  ok: true,
  value: {
    sessionId: "sess_1",
    status: "working",
    url: "https://app.qawolf.com/sessions/sess_1",
  },
} as const;

const base = {
  builds: undefined,
  environmentId: undefined,
  follow: false,
  message: "cover the checkout journey",
  filePaths: undefined,
  session: undefined,
  timeout: undefined,
  workspaceId: undefined,
};

describe("handleAgentSend with --builds", () => {
  it("names the builds the request is about", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(started);

    await handleAgentSend(
      ctx,
      { ...base, builds: ["abcdefghij0123456789klmnobld"] },
      makeTestDeps(),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toMatchObject({
      builds: ["abcdefghij0123456789klmnobld"],
    });
  });

  it("refuses a word that is not a build id, before any request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleAgentSend(
      ctx,
      { ...base, builds: ["flows/a.flow.ts"] },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.invalidArgs);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
