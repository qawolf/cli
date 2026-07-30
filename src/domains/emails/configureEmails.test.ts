import { describe, expect, it } from "bun:test";
import type { EmailsClient } from "@qawolf/emails";
import { configureEmails } from "./configureEmails.js";

const fakeClient: EmailsClient = {
  getInbox: () => {
    throw new Error("stub — getInbox should not be called in these tests");
  },
};

describe("configureEmails", () => {
  it("passes an emailerUrl config through with defaults", async () => {
    let capturedOpts: unknown;
    const deps = {
      createEmailsClient: async (opts: unknown) => {
        capturedOpts = opts;
        return fakeClient;
      },
      configureEmailsClient: () => {},
    };

    await configureEmails(
      { emailerUrl: "https://emailer.example" },
      "/test",
      deps,
    );

    expect(capturedOpts).toEqual({
      emailerUrl: "https://emailer.example",
      pollForEmailsDefaultTimeoutMs: 60_000,
      waitForMessagesDefaultDelayMs: 1_000,
    });
  });

  it("passes an apiKey/url config (with teamId) through with defaults", async () => {
    let capturedOpts: unknown;
    const deps = {
      createEmailsClient: async (opts: unknown) => {
        capturedOpts = opts;
        return fakeClient;
      },
      configureEmailsClient: () => {},
    };

    await configureEmails(
      {
        apiKey: "key_123",
        url: "https://app.qawolf.com/api",
        teamId: "team_123",
      },
      "/test",
      deps,
    );

    expect(capturedOpts).toEqual({
      apiKey: "key_123",
      url: "https://app.qawolf.com/api",
      teamId: "team_123",
      pollForEmailsDefaultTimeoutMs: 60_000,
      waitForMessagesDefaultDelayMs: 1_000,
    });
  });

  it("registers and returns the client created by createEmailsClient", async () => {
    let registeredClient: EmailsClient | undefined;
    const deps = {
      createEmailsClient: async () => fakeClient,
      configureEmailsClient: (client: EmailsClient) => {
        registeredClient = client;
      },
    };

    const returned = await configureEmails(
      { emailerUrl: "https://emailer.example" },
      "/test",
      deps,
    );

    expect(registeredClient).toBe(fakeClient);
    expect(returned).toBe(fakeClient);
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
      await configureEmails(
        { emailerUrl: "https://emailer.example" },
        "/test",
        deps,
      );
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("service unavailable");
  });

  it("propagates errors thrown by configureEmailsClient", async () => {
    const deps = {
      createEmailsClient: async () => fakeClient,
      configureEmailsClient: (): void => {
        throw new Error("registration failed");
      },
    };

    let caughtError: unknown;
    try {
      await configureEmails(
        { emailerUrl: "https://emailer.example" },
        "/test",
        deps,
      );
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("registration failed");
  });
});

describe("configureEmails: load failure", () => {
  it("names the env dir and points at `qawolf install`", async () => {
    let caught: unknown;
    try {
      await configureEmails({ emailerUrl: "https://x" }, "/nonexistent/env");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toStartWith(
      "Could not load @qawolf/emails from /nonexistent/env (",
    );
    expect((caught as Error).message).toEndWith(
      "Run `qawolf install` to install the runtime dependencies.",
    );
  });
});
