import { afterEach, describe, expect, it, mock } from "bun:test";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import { handleWhoami } from "./whoami.js";

afterEach(() => {
  mock.restore();
});

function makeTeam() {
  return {
    id: "t1",
    name: "Acme Corp",
    slug: "acme",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

function makeCtx(
  mode: "human" | "json" | "agent" = "human",
): AuthCommandContext {
  return {
    apiBaseUrl: "https://app.qawolf.com",
    apiKeySource: "env",
    team: makeTeam(),
    outputMode: mode,
    isInteractive: false,
    configDir: "/mock/config",
    platform: {} as PlatformClient,
    ui: {
      mode,
      gap: mock(),
      intro: mock(),
      note: mock(),
      outro: mock(),
      output: mock(),
      error: mock(),
      info: mock(),
      warn: mock(),
      write: mock(),
      json: mock(),
      cancel: mock(),
      step: mock(),
      success: mock(),
      confirm: mock(),
      password: mock(),
      withProgress: mock(),
    },
  } as unknown as AuthCommandContext;
}

describe("handleWhoami", () => {
  describe("human mode", () => {
    it("includes team slug in the note message", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("acme"),
        expect.any(String),
      );
    });

    it("includes team page URL in the note message", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("https://app.qawolf.com/acme"),
        expect.any(String),
      );
    });

    it("includes team name, ID, and source in the note message", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx);

      const [message] = (ctx.ui.note as ReturnType<typeof mock>).mock
        .calls[0] as [string, string];
      expect(message).toContain("Acme Corp");
      expect(message).toContain("t1");
      expect(message).toContain("env");
    });
  });

  describe("non-human mode", () => {
    it("outputs teamUrl in JSON output", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx);

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          teamUrl: "https://app.qawolf.com/acme",
        }),
        expect.any(String),
      );
    });

    it("outputs team object with slug in JSON output", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx);

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment
          team: expect.objectContaining({ slug: "acme" }),
        }),
        expect.any(String),
      );
    });

    it("outputs authenticated: true and source in JSON output", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx);

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: true,
          source: "env",
        }),
        expect.any(String),
      );
    });
  });
});
