import { describe, expect, it } from "bun:test";
import type { EmailsClient } from "@qawolf/emails";
import { configureEmails } from "./configureEmails.js";

const fakeClient: EmailsClient = {
  getInbox: () => {
    throw new Error("stub — getInbox should not be called in these tests");
  },
};

describe("configureEmails", () => {
  it("should call createEmailsClient with the correct options", async () => {
    let capturedOpts: unknown;
    const deps = {
      createEmailsClient: async (opts: unknown) => {
        capturedOpts = opts;
        return fakeClient;
      },
      configureEmailsClient: () => {},
    };

    await configureEmails("https://app.qawolf.com", deps);

    expect(capturedOpts).toEqual({
      emailerUrl: "https://app.qawolf.com",
      pollForEmailsDefaultTimeoutMs: 60_000,
      waitForMessagesDefaultDelayMs: 1_000,
    });
  });

  it("should register the client returned by createEmailsClient", async () => {
    let registeredClient: EmailsClient | undefined;
    const deps = {
      createEmailsClient: async () => fakeClient,
      configureEmailsClient: (client: EmailsClient) => {
        registeredClient = client;
      },
    };

    await configureEmails("https://example.com", deps);

    expect(registeredClient).toBe(fakeClient);
  });

  it("should propagate errors thrown by createEmailsClient", async () => {
    const deps = {
      createEmailsClient: async (): Promise<EmailsClient> => {
        throw new Error("service unavailable");
      },
      configureEmailsClient: () => {},
    };

    let caughtError: unknown;
    try {
      await configureEmails("https://example.com", deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("service unavailable");
  });

  it("should propagate errors thrown by configureEmailsClient", async () => {
    const deps = {
      createEmailsClient: async () => fakeClient,
      configureEmailsClient: (): void => {
        throw new Error("registration failed");
      },
    };

    let caughtError: unknown;
    try {
      await configureEmails("https://example.com", deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("registration failed");
  });
});
