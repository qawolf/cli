import { describe, expect, it } from "bun:test";
import type { EmailsClient } from "@qawolf/emails";
import { configureEmails } from "./configureEmails.js";

const fakeClient: EmailsClient = {
  getInbox: () => {
    throw new Error("stub — getInbox should not be called in these tests");
  },
};

const params = {
  apiBaseUrl: "https://app.qawolf.com",
  apiKey: "test-key",
  teamId: "team-1",
  cwd: "/test",
};

describe("configureEmails", () => {
  it("calls createEmailsClient with platform-proxied options", async () => {
    let capturedOpts: unknown;
    const deps = {
      createEmailsClient: async (opts: unknown) => {
        capturedOpts = opts;
        return fakeClient;
      },
      configureEmailsClient: () => {},
    };

    await configureEmails(params, deps);

    expect(capturedOpts).toEqual({
      url: "https://app.qawolf.com/api",
      apiKey: "test-key",
      teamId: "team-1",
      pollForEmailsDefaultTimeoutMs: 300_000,
      waitForMessagesDefaultDelayMs: 15_000,
    });
  });

  it("registers the client returned by createEmailsClient", async () => {
    let registeredClient: EmailsClient | undefined;
    const deps = {
      createEmailsClient: async () => fakeClient,
      configureEmailsClient: (client: EmailsClient) => {
        registeredClient = client;
      },
    };

    await configureEmails(params, deps);

    expect(registeredClient).toBe(fakeClient);
  });

  it("propagates errors thrown by createEmailsClient", async () => {
    const deps = {
      createEmailsClient: async (): Promise<EmailsClient> => {
        throw new Error("service unavailable");
      },
      configureEmailsClient: () => {},
    };

    let caughtError: unknown;
    try {
      await configureEmails(params, deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("service unavailable");
  });
});
