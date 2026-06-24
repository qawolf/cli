import { describe, expect, it } from "bun:test";
import type { Fs } from "~/shell/fs.js";
import { configureEmailsForRun } from "./configureEmailsForRun.js";

const fakeFs = {} as Fs;

function baseParams() {
  return {
    apiBaseUrl: "https://app.qawolf.com",
    configDir: "/cfg",
    cwd: "/env",
    fs: fakeFs,
    log: undefined,
  };
}

const okResolveApiKey = async () => ({ key: "k", source: "env" as const });
const okGetIdentity = async () => ({
  ok: true as const,
  data: { team: { id: "team-1", name: "T", createdAt: "2026-01-01" } },
});

describe("configureEmailsForRun", () => {
  it("configures emails on the happy path", async () => {
    let captured: unknown;
    const outcome = await configureEmailsForRun(baseParams(), {
      resolveApiKey: okResolveApiKey,
      getIdentity: okGetIdentity,
      configureEmails: async (p: unknown) => {
        captured = p;
      },
    });
    expect(outcome).toBe("configured");
    expect(captured).toEqual({
      apiBaseUrl: "https://app.qawolf.com",
      apiKey: "k",
      teamId: "team-1",
      cwd: "/env",
    });
  });

  it("skips when not authenticated and does not call configureEmails", async () => {
    let called = false;
    const outcome = await configureEmailsForRun(baseParams(), {
      resolveApiKey: async () => undefined,
      getIdentity: okGetIdentity,
      configureEmails: async () => {
        called = true;
      },
    });
    expect(outcome).toBe("skipped-not-authenticated");
    expect(called).toBe(false);
  });

  it("skips when identity cannot be resolved", async () => {
    const outcome = await configureEmailsForRun(baseParams(), {
      resolveApiKey: okResolveApiKey,
      getIdentity: async () => ({
        ok: false as const,
        error: { kind: "network" as const, cause: new Error("offline") },
      }),
      configureEmails: async () => {},
    });
    expect(outcome).toBe("skipped-identity-unavailable");
  });

  it("skips when the emails client cannot be built", async () => {
    const outcome = await configureEmailsForRun(baseParams(), {
      resolveApiKey: okResolveApiKey,
      getIdentity: okGetIdentity,
      configureEmails: async () => {
        throw new Error("module missing");
      },
    });
    expect(outcome).toBe("skipped-emails-unavailable");
  });
});
