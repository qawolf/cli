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
});
