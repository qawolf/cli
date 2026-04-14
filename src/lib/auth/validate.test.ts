import { describe, expect, it, vi } from "vitest";

import type { GetIdentityResult } from "../../clients/platform.js";

import { validateApiKey } from "./validate.js";

function makeDeps(result: GetIdentityResult) {
  return { getIdentity: vi.fn().mockResolvedValue(result) };
}

describe("validateApiKey", () => {
  it("returns invalid for empty key without calling the API", async () => {
    const deps = makeDeps({
      ok: true,
      data: { team: { createdAt: "", id: "", name: "" } },
    });
    const result = await validateApiKey("", deps);
    expect(result).toEqual({ valid: false, error: "API key is empty" });
    expect(deps.getIdentity).not.toHaveBeenCalled();
  });

  it("returns invalid for whitespace-only key without calling the API", async () => {
    const deps = makeDeps({
      ok: true,
      data: { team: { createdAt: "", id: "", name: "" } },
    });
    const result = await validateApiKey("   ", deps);
    expect(result).toEqual({ valid: false, error: "API key is empty" });
    expect(deps.getIdentity).not.toHaveBeenCalled();
  });

  it("returns valid with team identity on successful verification", async () => {
    const teamData = {
      createdAt: "2024-01-15T00:00:00.000Z",
      id: "team_123",
      name: "Acme Corp",
    };
    const deps = makeDeps({ ok: true, data: { team: teamData } });

    const result = await validateApiKey("qawolf_testapikey123", deps);
    expect(result).toEqual({ valid: true, team: teamData });
  });

  it("returns invalid when API responds with 401", async () => {
    const deps = makeDeps({
      ok: false,
      status: 401,
      error: "Invalid API token in Authorization header",
    } as GetIdentityResult);

    const result = await validateApiKey("qawolf_badkey", deps);
    expect(result).toEqual({
      valid: false,
      error: "API key is invalid or unauthorized",
    });
  });

  it("returns invalid when API responds with 403", async () => {
    const deps = makeDeps({
      ok: false,
      status: 403,
      error: "Team disabled",
    } as GetIdentityResult);

    const result = await validateApiKey("qawolf_disabledteam", deps);
    expect(result).toEqual({
      valid: false,
      error: "API key is invalid or unauthorized",
    });
  });

  it("returns invalid with error message on network failure", async () => {
    const deps = makeDeps({
      ok: false,
      error: "fetch failed",
    } as GetIdentityResult);

    const result = await validateApiKey("qawolf_testapikey123", deps);
    expect(result).toEqual({
      valid: false,
      error: "Could not verify API key: fetch failed",
    });
  });

  it("returns invalid on server error", async () => {
    const deps = makeDeps({
      ok: false,
      status: 500,
      error: "Internal Server Error",
    } as GetIdentityResult);

    const result = await validateApiKey("qawolf_testapikey123", deps);
    expect(result).toEqual({
      valid: false,
      error: "Could not verify API key: Internal Server Error",
    });
  });
});
