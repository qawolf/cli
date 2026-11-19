import { describe, expect, it } from "bun:test";

import {
  fakeServer,
  trpcReply,
} from "~/domains/publicApi/fakeServer.testUtils.js";
import { ctxWith } from "~/domains/publicApi/handle.testUtils.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";
import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";

import { handleSlackPost, type SlackPostOptions } from "./post.js";

const permalink = "https://acme.slack.com/archives/C0123ABCD/p1792000776456809";

function post(answer: unknown, options: Partial<SlackPostOptions> = {}) {
  const server = fakeServer({ "slack.post": () => trpcReply(answer) });
  const ui = makeFakeUI();
  const platformClient = createPlatformClient("qawolf_session_jwt", {
    baseUrl: "https://app.qawolf.com",
    fetch: server.fetch,
    sleep: async () => {},
  });
  const result = handleSlackPost(
    ctxWith(ui, platformClient),
    {
      channel: "C0123ABCD",
      text: "Nightly smoke passed",
      thread: undefined,
      ...options,
    },
    { makeNewId: () => "new-1" },
  );
  return { result, server, ui };
}

const refusal = (outcome: string) => ({
  message: `Refused as ${outcome}.`,
  outcome,
});

describe("qawolf slack post", () => {
  it("posts the message and prints its link", async () => {
    const { result, server, ui } = post({
      channelId: "C0123ABCD",
      messageTs: "1792000776.456809",
      outcome: "posted",
      permalink,
    });

    expect(await result).toBeUndefined();
    expect(server.bodyOf("slack.post")).toEqual({
      channelId: "C0123ABCD",
      newId: "new-1",
      text: "Nightly smoke passed",
    });
    expect(ui.output).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "posted", permalink }),
      `Posted in Slack: ${permalink}`,
    );
  });

  it("replies in the thread it is given", async () => {
    const { result, server } = post(
      {
        channelId: "C0123ABCD",
        messageTs: "1792000800.000100",
        outcome: "posted",
        permalink,
        threadTs: "1792000776.456809",
      },
      { thread: "1792000776.456809" },
    );

    expect(await result).toBeUndefined();
    expect(server.bodyOf("slack.post")).toMatchObject({
      threadTs: "1792000776.456809",
    });
  });

  it.each([
    [
      "not-a-loop-session",
      "QA Wolf posted nothing: only a QA Wolf session that a loop started can post in Slack.",
    ],
    [
      "loop-deleted",
      "QA Wolf posted nothing: the loop that started this session was deleted.",
    ],
    [
      "channel-not-allowed",
      "QA Wolf posted nothing: C0123ABCD is not one of the workspace's own Slack channels.",
    ],
    [
      "agent-not-in-channel",
      "QA Wolf posted nothing: the QA Wolf agent is not in C0123ABCD. Invite it to the channel, then post again.",
    ],
    [
      "rate-limited",
      "QA Wolf posted nothing: this loop run already posted 5 Slack messages, the most one run may post.",
    ],
  ])(
    "fails with a plain message when refused as %s",
    async (outcome, error) => {
      const { result, ui } = post(refusal(outcome));

      expect(await result).toEqual({
        error,
        errorBody: `Refused as ${outcome}.`,
        exitCode: exitCodes.testFailure,
      });
      expect(ui.output).not.toHaveBeenCalled();
    },
  );

  it("rejects a channel that is not a Slack channel ID before calling QA Wolf", async () => {
    const { result, server } = post(refusal("channel-not-allowed"), {
      channel: "#general",
    });

    expect(await result).toMatchObject({ exitCode: exitCodes.invalidArgs });
    expect(server.calledPaths()).toEqual([]);
  });

  it("says the server does not support slack.post yet", async () => {
    const server = fakeServer({});
    const platformClient = createPlatformClient("qawolf_session_jwt", {
      baseUrl: "https://app.qawolf.com",
      fetch: server.fetch,
      sleep: async () => {},
    });

    const result = await handleSlackPost(
      {
        ...ctxWith(makeFakeUI(), platformClient),
        apiBaseUrl: "https://app.qawolf.com",
      },
      { channel: "C0123ABCD", text: "Nightly smoke passed", thread: undefined },
      { makeNewId: () => "new-1" },
    );

    expect(result?.error).toStartWith(
      "QA Wolf at https://app.qawolf.com does not support slack.post yet",
    );
  });
});
