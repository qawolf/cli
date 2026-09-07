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

    // The saved workspace lives outside the organization this sign-in was
    // granted, so every request naming it is refused. Nothing switches access
    // locally: the person has to pick one in reach, or sign in to the other
    // organization.
    it("says a saved workspace outside the grant needs a switch or a new sign-in", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      const deps = makeUserDeps();
      deps.requireApiKey = mock(() =>
        Promise.resolve({
          key: "test-key",
          source: "browser" as const,
          workspaceId: "ws_elsewhere",
        }),
      );

      await handleWhoami(ctx, deps);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("qawolf auth login"),
        expect.any(String),
      );
    });

    // The list can name more than the granted organization. A saved workspace
    // under one of the others is not usable by this token, so it must not be
    // reported as active.
    it("does not report a workspace from another listed organization as active", async () => {
      const ctx = makeCtx("human", { apiBaseUrl: "https://app.qawolf.com" });
      const deps = makeDeps({
        requireApiKey: mock(() =>
          Promise.resolve({
            key: "test-key",
            source: "browser" as const,
            workspaceId: "ws_other",
          }),
        ),
        getIdentity: mock(() =>
          Promise.resolve({
            ok: true as const,
            value: {
              organization: { id: "qw_org_1", name: "Acme Inc" },
              user: { email: "user@example.com", id: "user_1" },
              organizations: [
                {
                  id: "qw_org_1",
                  name: "Acme Inc",
                  workOsOrganizationId: "org_1",
                  workspaces: [{ id: "ws_1", name: "Acme", slug: "acme" }],
                },
                {
                  id: "qw_org_2",
                  name: "Other Co",
                  workOsOrganizationId: "org_2",
                  workspaces: [
                    { id: "ws_other", name: "Other", slug: "other" },
                  ],
                },
              ],
            },
          }),
        ),
      });

      await handleWhoami(ctx, deps);

      expect(ctx.ui.note).toHaveBeenCalledWith(
        expect.stringContaining("not in the organization you signed in to"),
        expect.any(String),
      );
    });
  });
});
