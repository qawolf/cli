import { afterEach, describe, expect, it, mock } from "bun:test";
import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { handleWhoami } from "./whoami.js";
import { makeDeps } from "./whoami.testUtils.js";

afterEach(() => {
  mock.restore();
});

describe("handleWhoami", () => {
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

    it("carries the identity failure's exit code into the result", async () => {
      const deps = makeDeps({
        getIdentity: mock(() =>
          Promise.resolve({
            ok: false as const,
            error: "API key is invalid",
            exitCode: 3,
          }),
        ),
      });
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });

      const result = await handleWhoami(ctx, deps);

      expect(result).toEqual({ error: "invalid key", exitCode: 3 });
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

    it("returns an error result with the auth exit code", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      const result = await handleWhoami(ctx, noDeps);
      expect(result).toEqual({ error: "not authenticated", exitCode: 3 });
    });
  });
});
