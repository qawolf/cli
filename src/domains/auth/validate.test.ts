import { afterEach, describe, expect, it, mock } from "bun:test";

import type {
  PlatformClient,
  PlatformResult,
} from "~/shell/platform/createPlatformClient.js";
import type { IdentityResponse } from "~/shell/platform/getIdentity.js";
import { makeMockPlatformClient } from "~/shell/platform/createPlatformClient.testUtils.js";

import { validateApiKey } from "./validate.js";

afterEach(() => {
  mock.restore();
});

function makeDeps(result: PlatformResult<IdentityResponse>) {
  return {
    platform: makeMockPlatformClient({
      getIdentity:
        mock<PlatformClient["getIdentity"]>().mockResolvedValue(result),
    }),
  };
}

describe("validateApiKey", () => {
  it("returns invalid for empty key without calling the API", async () => {
    const deps = makeDeps({
      ok: true,
      value: { team: { createdAt: "", id: "", name: "" } },
    });
    const result = await validateApiKey("", deps);
    expect(result).toEqual({ valid: false, error: "API key is empty" });
    expect(deps.platform.getIdentity).not.toHaveBeenCalled();
  });

  it("returns invalid for whitespace-only key without calling the API", async () => {
    const deps = makeDeps({
      ok: true,
      value: { team: { createdAt: "", id: "", name: "" } },
    });
    const result = await validateApiKey("   ", deps);
    expect(result).toEqual({ valid: false, error: "API key is empty" });
    expect(deps.platform.getIdentity).not.toHaveBeenCalled();
  });

  it("returns valid with team identity on successful verification", async () => {
    const teamData = {
      createdAt: "2024-01-15T00:00:00.000Z",
      id: "team_123",
      name: "Acme Corp",
    };
    const deps = makeDeps({ ok: true, value: { team: teamData } });

    const result = await validateApiKey("qawolf_testapikey123", deps);
    expect(result).toEqual({ valid: true, team: teamData });
    expect(deps.platform.getIdentity).toHaveBeenCalled();
  });

  it("returns invalid when API responds with 401 (already formatted by platform client)", async () => {
    const deps = makeDeps({
      ok: false,
      error: "API key is invalid or unauthorized",
    });

    const result = await validateApiKey("qawolf_badkey", deps);
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

    const result = await validateApiKey("qawolf_disabledteam", deps);
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

    const result = await validateApiKey("qawolf_testapikey123", deps);
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

    const result = await validateApiKey("qawolf_testapikey123", deps);
    expect(result).toEqual({
      valid: false,
      error: "Could not verify API key: Internal Server Error",
    });
  });
});
