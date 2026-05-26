import { describe, expect, it, mock } from "bun:test";

import { getRemoteFlows } from "./getRemoteFlows.js";

function createFetchMock(resolvedValue: Response): typeof fetch {
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

const sampleFlow = {
  executionTarget: "Web - Chrome",
  id: "h68oxv33hwdnhthx4918560zowor",
  name: "Read Team Storage Files",
  path: "src/flows/team-storage/read-team-storage-files.flow.ts",
  tags: [],
};

describe("getRemoteFlows", () => {
  it("sends the API key as a Bearer token to /api/v0/flows?includeDrafts=false", async () => {
    const mockFetch = createFetchMock(jsonResponse({ flows: [sampleFlow] }));

    await getRemoteFlows("qawolf_mykey", {
      fetch: mockFetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.qawolf.com/api/v0/flows?includeDrafts=false",
      expect.objectContaining({
        headers: { Authorization: "Bearer qawolf_mykey" },
      }),
    );
  });

  it("returns ok with parsed flows on success", async () => {
    const result = await getRemoteFlows("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ flows: [sampleFlow] })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: true, data: { flows: [sampleFlow] } });
  });

  it("returns ok with empty array when no flows exist", async () => {
    const result = await getRemoteFlows("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ flows: [] })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: true, data: { flows: [] } });
  });

  it("returns http WireError with status on auth failure", async () => {
    const result = await getRemoteFlows("qawolf_badkey", {
      fetch: createFetchMock(
        new Response('{"error":"You are not authenticated."}', {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "http",
        status: 401,
        body: '{"error":"You are not authenticated."}',
      },
    });
  });

  it("returns network WireError on fetch failure", async () => {
    const cause = new Error("fetch failed");
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      cause,
    ) as unknown as typeof fetch;

    const result = await getRemoteFlows("qawolf_key", {
      fetch: mockFetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: false, error: { kind: "network", cause } });
  });

  it("returns parse WireError when response body does not match schema", async () => {
    const result = await getRemoteFlows("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ unexpected: "shape" })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse");
  });

  it("accepts ad-hoc object executionTarget in addition to preset strings", async () => {
    const flow = {
      executionTarget: { runner: "android", device: "Pixel 7" },
      id: "id-3",
      name: "Custom Android",
      path: "src/flows/mobile/custom.flow.ts",
      tags: [],
    };
    const result = await getRemoteFlows("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ flows: [flow] })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: true, data: { flows: [flow] } });
  });

  it("returns parse WireError when a flow entry is missing fields", async () => {
    const result = await getRemoteFlows("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ flows: [{ id: "x" }] })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse");
  });
});
