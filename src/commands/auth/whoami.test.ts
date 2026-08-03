import { afterEach, describe, expect, it, mock } from "bun:test";
import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { handleWhoami } from "./whoami.js";
import { makeDeps } from "./whoami.testUtils.js";

afterEach(() => {
  mock.restore();
});

describe("handleWhoami", () => {
  describe("human mode — authenticated", () => {
    it("includes team slug in the note message", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("acme"),
        expect.any(String),
      );
    });

    it("includes team page URL in the note message", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("https://app.qawolf.com/acme"),
        expect.any(String),
      );
    });

    it("includes team name, ID, and source in the note message", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeDeps());

      const [message] = (ctx.ui.note as ReturnType<typeof mock>).mock
        .calls[0] as [string, string];
      expect(message).toContain("Acme Corp");
      expect(message).toContain("t1");
      expect(message).toContain("env");
    });

    it("calls outro to signal completion", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.outro).toHaveBeenCalled();
    });
  });

  describe("non-human mode — authenticated", () => {
    it("outputs teamUrl in JSON output", async () => {
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeDeps());

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          teamUrl: "https://app.qawolf.com/acme",
        }),
        expect.any(String),
      );
    });

    it("outputs team object with slug in JSON output", async () => {
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
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
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
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

  describe("organization identity", () => {
    function makeOrgDeps() {
      return makeDeps({
        getIdentity: mock(() =>
          Promise.resolve({
            ok: true as const,
            value: { organization: { id: "org_1", name: "Acme Org" } },
          }),
        ),
      });
    }

    it("outputs the organization in JSON output", async () => {
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeOrgDeps());

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: true,
          organization: { id: "org_1", name: "Acme Org" },
          source: "env",
        }),
        expect.any(String),
      );
    });

    it("includes the organization name in the human note", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeOrgDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("Acme Org"),
        expect.any(String),
      );
    });
  });

  describe("user identity", () => {
    function makeUserDeps() {
      return makeDeps({
        getIdentity: mock(() =>
          Promise.resolve({
            ok: true as const,
            value: {
              organization: { id: "org_1", name: "Acme Org" },
              user: { email: "user@example.com", id: "user_1" },
            },
          }),
        ),
      });
    }

    it("outputs the user and organization in JSON output", async () => {
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeUserDeps());

      expect(ctx.ui.output).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: true,
          organization: { id: "org_1", name: "Acme Org" },
          source: "env",
          user: { email: "user@example.com", id: "user_1" },
        }),
        expect.any(String),
      );
    });

    it("includes the user email in the human note", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeUserDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("user@example.com"),
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
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, failDeps);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("env"),
        expect.any(String),
      );
      expect(ctx.ui.warn).toHaveBeenCalledWith("API key is invalid");
    });

    it("outputs authenticated: false in JSON mode", async () => {
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
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
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
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
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, noDeps);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("QAWOLF_API_KEY"),
        expect.any(String),
      );
    });

    it("outputs authenticated: false with null source in JSON mode", async () => {
      const ctx = makeCtx("json", { apiBaseUrl: "https://app.qawolf.com" });
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
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      const result = await handleWhoami(ctx, noDeps);
      expect(result).toEqual({ error: "not authenticated" });
    });
  });
});
