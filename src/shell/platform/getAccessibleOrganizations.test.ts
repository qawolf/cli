import { describe, expect, it, mock } from "bun:test";

import { getAccessibleOrganizations } from "./getAccessibleOrganizations.js";

function createFetchMock(resolvedValue: Response) {
  return mock<typeof fetch>().mockResolvedValue(
    resolvedValue,
  ) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const body = {
  organizations: [
    {
      id: "qw_1",
      name: "Acme Inc",
      workOsOrganizationId: "org_1",
      workspaces: [{ id: "ws_1", name: "Main", slug: "main" }],
    },
  ],
};

const deps = { baseUrl: "https://test.qawolf.com" };

describe("getAccessibleOrganizations", () => {
  it("reads the discovery endpoint with the caller's bearer token", async () => {
    const mockFetch = createFetchMock(jsonResponse(body));

    await getAccessibleOrganizations("tok", { ...deps, fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.qawolf.com/api/v0/identity/organizations",
      expect.objectContaining({ headers: { Authorization: "Bearer tok" } }),
    );
  });

  it("returns every organization the caller can act on", async () => {
    const result = await getAccessibleOrganizations("tok", {
      ...deps,
      fetch: createFetchMock(jsonResponse(body)),
    });

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "qw_1",
          name: "Acme Inc",
          workOsOrganizationId: "org_1",
          workspaces: [{ id: "ws_1", name: "Main", slug: "main" }],
        },
      ],
    });
  });

  it("reports an empty list rather than treating it as unsupported", async () => {
    const result = await getAccessibleOrganizations("tok", {
      ...deps,
      fetch: createFetchMock(jsonResponse({ organizations: [] })),
    });

    expect(result).toEqual({ ok: true, data: [] });
  });

  it("fails on a server that does not serve the endpoint", async () => {
    const result = await getAccessibleOrganizations("tok", {
      ...deps,
      fetch: createFetchMock(jsonResponse({}, { status: 404 })),
    });

    expect(result.ok).toBe(false);
  });

  it("fails rather than reporting none when the body is not the contract", async () => {
    const result = await getAccessibleOrganizations("tok", {
      ...deps,
      fetch: createFetchMock(jsonResponse({ nonsense: true })),
    });

    expect(result.ok).toBe(false);
  });

  it("fails when the network is unreachable", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("connect ECONNREFUSED"),
    ) as unknown as typeof fetch;

    const result = await getAccessibleOrganizations("tok", {
      ...deps,
      fetch: mockFetch,
    });

    expect(result.ok).toBe(false);
  });
});
