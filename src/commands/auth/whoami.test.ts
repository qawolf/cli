import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ApiKeyResult } from "~/domains/auth/types.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { IdentityResponse } from "~/shell/platform/getIdentity.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { handleWhoami } from "./whoami.js";

afterEach(() => {
  mock.restore();
});

function makeTeam(): IdentityResponse["team"] {
  return {
    id: "t1",
    name: "Acme Corp",
    slug: "acme",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

function makeCtx(mode: "human" | "json" | "agent" = "human"): CommandContext {
  return {
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: mode,
    isInteractive: false,
    configDir: "/mock/config",
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
  } as unknown as CommandContext;
}

function makeDeps(
  overrides: {
    requireApiKey?: () => Promise<ApiKeyResult>;
    getIdentity?: () => Promise<PlatformResult<IdentityResponse>>;
  } = {},
) {
  const getIdentity =
    overrides.getIdentity ??
    mock(() =>
      Promise.resolve({
        ok: true as const,
        value: { team: makeTeam() },
      }),
    );
  return {
    requireApiKey:
      overrides.requireApiKey ??
      mock(() => Promise.resolve({ key: "test-key", source: "env" as const })),
    createPlatform: mock(() => ({ getIdentity }) as unknown as PlatformClient),
  };
}

describe("handleWhoami", () => {
  describe("human mode — authenticated", () => {
    it("includes team slug in the note message", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("acme"),
        expect.any(String),
      );
    });

    it("includes team page URL in the note message", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("https://app.qawolf.com/acme"),
        expect.any(String),
      );
    });

    it("includes team name, ID, and source in the note message", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx, makeDeps());

      const [message] = (ctx.ui.note as ReturnType<typeof mock>).mock
        .calls[0] as [string, string];
      expect(message).toContain("Acme Corp");
      expect(message).toContain("t1");
      expect(message).toContain("env");
    });
  });

  describe("non-human mode — authenticated", () => {
    it("outputs teamUrl in JSON output", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          teamUrl: "https://app.qawolf.com/acme",
        }),
        expect.any(String),
      );
    });

    it("outputs team object with slug in JSON output", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx, makeDeps());

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
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: true,
          source: "env",
        }),
        expect.any(String),
      );
    });
  });

  describe("identity failure", () => {
    const failDeps = makeDeps({
      getIdentity: mock(() =>
        Promise.resolve({ ok: false as const, error: "API key is invalid" }),
      ),
    });

    it("shows whoamiFailed note in human mode", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx, failDeps);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("env"),
        expect.any(String),
      );
      expect(ctx.ui.warn).toHaveBeenCalledWith("API key is invalid");
    });

    it("outputs authenticated: false in JSON mode", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx, failDeps);

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: false,
          valid: false,
          error: "API key is invalid",
          source: "env",
        }),
        expect.any(String),
      );
    });

    it("returns an error result", async () => {
      const ctx = makeCtx("human");
      const result = await handleWhoami(ctx, failDeps);
      expect(result).toEqual({ error: "invalid key" });
    });
  });

  describe("no API key", () => {
    const noDeps = makeDeps({
      requireApiKey: mock(() =>
        Promise.reject(new Error("QAWOLF_API_KEY is not set")),
      ),
    });

    it("shows whoamiFailed note in human mode", async () => {
      const ctx = makeCtx("human");
      await handleWhoami(ctx, noDeps);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("QAWOLF_API_KEY"),
        expect.any(String),
      );
    });

    it("outputs authenticated: false with null source in JSON mode", async () => {
      const ctx = makeCtx("json");
      await handleWhoami(ctx, noDeps);

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: false,
          source: undefined,
        }),
        expect.any(String),
      );
    });

    it("returns an error result", async () => {
      const ctx = makeCtx("human");
      const result = await handleWhoami(ctx, noDeps);
      expect(result).toEqual({ error: "not authenticated" });
    });
  });
});
