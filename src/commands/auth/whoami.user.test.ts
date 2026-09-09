import { afterEach, describe, expect, it, mock } from "bun:test";
import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { handleWhoami } from "./whoami.js";
import { makeDeps } from "./whoami.testUtils.js";

afterEach(() => {
  mock.restore();
});

describe("handleWhoami", () => {
  describe("user identity", () => {
    function makeUserDeps() {
      return makeDeps({
        getIdentity: mock(() =>
          Promise.resolve({
            ok: true as const,
            value: {
              organization: { id: "org_1", name: "Acme Org" },
              user: { email: "user@example.com", id: "user_1" },
              organizations: [
                {
                  id: "qw_org_1",
                  name: "Acme Inc",
                  workOsOrganizationId: "org_1",
                  workspaces: [
                    { id: "ws_1", name: "Acme", slug: "acme" },
                    { id: "ws_2", name: "Side Project", slug: "side" },
                  ],
                },
              ],
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

    it("names each organization and the workspaces inside it", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      await handleWhoami(ctx, makeUserDeps());

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("Acme Inc: Acme, Side Project"),
        expect.any(String),
      );
    });
  });
});
