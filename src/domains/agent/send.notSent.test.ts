import { describe, expect, it, mock } from "bun:test";
import superjson from "superjson";

import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";

import { handleAgentSend } from "./send.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const reply = (value: unknown) =>
  Response.json({ result: { data: superjson.serialize(value) } });

describe("handleAgentSend after its first write succeeded", () => {
  it("does not call the command safe to rerun when the answer was never sent", async () => {
    const { ctx: base } = makeAuthCtx("human", { isInteractive: true });
    base.ui.text = mock(async () => ({ ok: true, value: "acme" }) as const);
    const url = "https://app.qawolf.com/sessions/sess_1";
    const asking = {
      nextCursor: "c1",
      replies: [
        {
          askedAt: "2026-09-09T12:00:00.000Z",
          id: "r1",
          text: "Which account?",
        },
      ],
      sessionId: "sess_1",
      status: "waiting-for-you",
      url,
    };
    const refused = Object.assign(new TypeError("Unable to connect."), {
      code: "ConnectionRefused",
    });
    const fetch = mock<typeof globalThis.fetch>()
      // The session is created, then asks a question.
      .mockResolvedValueOnce(
        reply({ sessionId: "sess_1", status: "working", url }),
      )
      .mockResolvedValueOnce(reply(asking))
      // The answer never leaves.
      .mockRejectedValueOnce(refused);
    const ctx = {
      ...base,
      platformClient: createPlatformClient("qawolf_key", {
        baseUrl: "https://test.qawolf.com",
        fetch: fetch as unknown as typeof globalThis.fetch,
        sleep: async () => {},
      }),
    };

    const result = await handleAgentSend(
      ctx,
      {
        builds: undefined,
        environmentId: undefined,
        filePaths: undefined,
        follow: true,
        message: "cover the checkout journey",
        session: undefined,
        timeout: undefined,
        workspaceId: undefined,
      },
      makeTestDeps(),
    );

    expect(result?.error).toBe(
      "The answer could not be sent: Could not reach the QA Wolf API at https://test.qawolf.com to fetch agent.send (ConnectionRefused: Unable to connect.). Check your network connection and QAWOLF_HOST_URL. Nothing was sent, so this request did not take effect. The session is still waiting, so try again.",
    );
  });
});
