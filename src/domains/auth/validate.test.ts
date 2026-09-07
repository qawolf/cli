import { afterEach, describe, expect, it, mock } from "bun:test";

import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { PlatformResult } from "~/shell/platform/requestWithRetry.js";
import type { IdentityResponse } from "~/shell/platform/getIdentity.js";
import { makeMockPlatformClient } from "~/shell/platform/createPlatformClient.testUtils.js";

import { validateApiKey } from "./validate.js";

afterEach(() => {
  mock.restore();
});

function makeDeps(result: PlatformResult<IdentityResponse>) {
  return {
    platformClient: makeMockPlatformClient({
      getIdentity:
        mock<PlatformClient["getIdentity"]>().mockResolvedValue(result),
    }),
  };
}

describe("validateApiKey", () => {
  it("returns valid on successful team verification", async () => {
    const deps = makeDeps({
      ok: true,
      value: {
        team: {
          createdAt: "2024-01-15T00:00:00.000Z",
          id: "team_123",
          name: "Acme Corp",
          slug: "acme",
        },
        organizations: [],
      },
    });

    const result = await validateApiKey(deps);
    expect(result).toEqual({ valid: true });
    expect(deps.platformClient.getIdentity).toHaveBeenCalled();
  });

  it("returns valid on successful organization verification", async () => {
    const deps = makeDeps({
      ok: true,
      value: {
        organization: { id: "org_1", name: "Acme Org" },
        organizations: [],
      },
    });

    const result = await validateApiKey(deps);
    expect(result).toEqual({ valid: true });
  });

  it("returns invalid when API responds with 401 (already formatted by platform client)", async () => {
    const deps = makeDeps({
      ok: false,
      error: "API key is invalid or unauthorized",
    });

    const result = await validateApiKey(deps);
    expect(result).toEqual({
      valid: false,
      error: "API key is invalid or unauthorized",
    });
  });

  it("returns invalid when API responds with 403 (already formatted by platform client)", async () => {
    const deps = makeDeps({
      ok: false,
      error: "API key is invalid or unauthorized",
    });

    const result = await validateApiKey(deps);
    expect(result).toEqual({
      valid: false,
      error: "API key is invalid or unauthorized",
    });
  });

  it("passes through the error string from the platform client", async () => {
    const deps = makeDeps({
      ok: false,
      error: "Could not verify API key: fetch failed",
    });

    const result = await validateApiKey(deps);
    expect(result).toEqual({
      valid: false,
      error: "Could not verify API key: fetch failed",
    });
  });

  it("passes through server error from the platform client", async () => {
    const deps = makeDeps({
      ok: false,
      error: "Could not verify API key: Internal Server Error",
    });

    const result = await validateApiKey(deps);
    expect(result).toEqual({
      valid: false,
      error: "Could not verify API key: Internal Server Error",
    });
  });
});
