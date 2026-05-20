import { afterEach, describe, expect, it, mock, type Mock } from "bun:test";

import { createPlatformClient } from "./createPlatformClient.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_key";
const noSleep = async (): Promise<void> => {};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(response: Response): typeof fetch {
  return mock<typeof fetch>().mockResolvedValue(
    response,
  ) as unknown as typeof fetch;
}

function callCount(f: typeof fetch): number {
  return (f as unknown as Mock<typeof fetch>).mock.calls.length;
}

describe("getIdentity", () => {
  it("sends GET to /api/v0/identity with Bearer token and returns team on success", async () => {
    const team = { id: "t1", name: "T", createdAt: "2024-01-01T00:00:00.000Z" };
    const f = mockFetch(json({ team }));

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).getIdentity();

    const url = (f as unknown as Mock<typeof fetch>).mock
      .calls[0]?.[0] as string;
    const auth = (
      (f as unknown as Mock<typeof fetch>).mock.calls[0]?.[1] as RequestInit
    )?.headers as Record<string, string> | undefined;
    expect(url).toBe(`${baseUrl}/api/v0/identity`);
    expect(auth?.["Authorization"]).toBe(`Bearer ${apiKey}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.team).toEqual(team);
  });

  it("returns ok:false with auth error for HTTP 401", async () => {
    const result = await createPlatformClient(apiKey, {
      fetch: mockFetch(new Response("", { status: 401 })),
      baseUrl,
    }).getIdentity();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid or unauthorized/i);
  });

  it("returns ok:false with auth error for HTTP 403", async () => {
    const result = await createPlatformClient(apiKey, {
      fetch: mockFetch(new Response("", { status: 403 })),
      baseUrl,
    }).getIdentity();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid or unauthorized/i);
  });

  it("retries on a network error and returns ok on the second attempt", async () => {
    const m = mock<typeof fetch>();
    m.mockRejectedValueOnce(new TypeError("fetch failed"));
    m.mockResolvedValueOnce(
      json({
        team: { id: "t1", name: "T", createdAt: "2024-01-01T00:00:00.000Z" },
      }),
    );
    const f = m as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).getIdentity();

    expect(result.ok).toBe(true);
    expect(callCount(f)).toBe(2);
  });

  it("returns ok:false after exhausting the retry budget (3 network failures)", async () => {
    const f = mock<typeof fetch>().mockRejectedValue(
      new TypeError("fetch failed"),
    ) as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).getIdentity();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Could not verify API key/);
    expect(callCount(f)).toBe(3);
  });

  it("does not retry on an HTTP 404", async () => {
    const m = mock<typeof fetch>()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        json({
          team: {
            id: "t1",
            name: "T",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        }),
      );
    const f = m as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).getIdentity();

    expect(result.ok).toBe(false);
    expect(callCount(f)).toBe(1);
  });
});
