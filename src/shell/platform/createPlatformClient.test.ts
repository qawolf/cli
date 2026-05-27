// oxlint-disable eslint/max-lines -- regression coverage for the gitwolf.getFlowsBundleUrl payload-key wire-format bug added 3 lines; splitting the file is more churn than the test warrants
import { afterEach, describe, expect, it, mock, type Mock } from "bun:test";
import superjson from "superjson";

import { createPlatformClient } from "./createPlatformClient.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_key";
const envId = "env-abc";
const noSleep = async (): Promise<void> => {};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function trpcWrapped(value: unknown) {
  return { result: { data: superjson.serialize(value) } };
}

function mockFetch(response: Response): typeof fetch {
  return mock<typeof fetch>().mockResolvedValue(
    response,
  ) as unknown as typeof fetch;
}

function calledRequest(f: typeof fetch) {
  const [url, init] = (f as unknown as Mock<typeof fetch>).mock.calls[0] ?? [];
  const h = init?.headers as Record<string, string> | undefined;
  return {
    url: url as string,
    method: init?.method ?? "",
    auth: h?.["Authorization"],
    body: init?.body as string | undefined,
  };
}

function callCount(f: typeof fetch): number {
  return (f as unknown as Mock<typeof fetch>).mock.calls.length;
}

describe("getIdentity", () => {
  it("sends GET to /api/v0/identity with Bearer token and returns team on success", async () => {
    const team = {
      id: "t1",
      name: "T",
      createdAt: "2024-01-01T00:00:00.000Z",
      slug: "acme",
    };
    const f = mockFetch(json({ team }));

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).getIdentity();

    const req = calledRequest(f);
    expect(req.url).toBe(`${baseUrl}/api/v0/identity`);
    expect(req.auth).toBe(`Bearer ${apiKey}`);
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
        team: {
          id: "t1",
          name: "T",
          createdAt: "2024-01-01T00:00:00.000Z",
          slug: "acme",
        },
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

const signedUrl = "https://storage.example.com/bundle.tar.gz?sig=x";

describe("getFlowsBundleUrl", () => {
  it("POSTs to gitwolf.getFlowsBundleUrl with Bearer token and returns signedUrl", async () => {
    const f = mockFetch(
      json(
        trpcWrapped({ url: signedUrl, expiresAt: "2099-12-31T00:00:00.000Z" }),
      ),
    );

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).getFlowsBundleUrl(envId);

    const req = calledRequest(f);
    expect(req.url).toContain("/api/trpc/gitwolf.getFlowsBundleUrl");
    expect(req.method).toBe("POST");
    expect(req.auth).toBe(`Bearer ${apiKey}`);
    const parsed = JSON.parse(req.body!) as { json: Record<string, string> };
    expect(parsed.json).toEqual({ environmentId: envId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.signedUrl).toBe(signedUrl);
  });

  it("returns ok:false with not-found message on HTTP 404", async () => {
    const result = await createPlatformClient(apiKey, {
      fetch: mockFetch(new Response("not found", { status: 404 })),
      baseUrl,
      sleep: noSleep,
    }).getFlowsBundleUrl(envId);

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatch(/could not find that environment/i);
  });

  it("retries on a network error and returns ok on the second attempt", async () => {
    const m = mock<typeof fetch>();
    m.mockRejectedValueOnce(new TypeError("fetch failed"));
    m.mockResolvedValueOnce(
      json(
        trpcWrapped({ url: signedUrl, expiresAt: "2099-12-31T00:00:00.000Z" }),
      ),
    );
    const f = m as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).getFlowsBundleUrl(envId);

    expect(result.ok).toBe(true);
    expect(callCount(f)).toBe(2);
  });
});

describe("getEnvVars", () => {
  const vars = { TOKEN: "abc", URL: "https://example.com" };

  it("GETs environment.getEnvironmentWithVariables with Bearer token and returns vars", async () => {
    const f = mockFetch(json(trpcWrapped({ environmentVariables: vars })));

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).getEnvVars(envId);

    const req = calledRequest(f);
    expect(req.url).toContain(
      "/api/trpc/environment.getEnvironmentWithVariables",
    );
    expect(req.method).toBe("GET");
    expect(req.auth).toBe(`Bearer ${apiKey}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(vars);
  });

  it("passes envId as `id` in the query param", async () => {
    const f = mockFetch(json(trpcWrapped({ environmentVariables: {} })));
    await createPlatformClient(apiKey, { fetch: f, baseUrl }).getEnvVars(envId);

    const encoded = new URL(calledRequest(f).url).searchParams.get("input");
    expect(encoded).not.toBeNull();
    const parsed = JSON.parse(encoded!) as { json: Record<string, string> };
    expect(parsed.json).toEqual({ id: envId });
  });

  it("returns ok:false with env-vars named message on HTTP 404", async () => {
    const result = await createPlatformClient(apiKey, {
      fetch: mockFetch(new Response("not found", { status: 404 })),
      baseUrl,
      sleep: noSleep,
    }).getEnvVars(envId);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/env-vars/i);
  });
});
