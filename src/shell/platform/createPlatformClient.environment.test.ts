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
  };
}

describe("getEnvironmentWithVariables", () => {
  const vars = { TOKEN: "abc", URL: "https://example.com" };
  const teamId = "team-owning-env";
  const environment = () =>
    mockFetch(json(trpcWrapped({ environmentVariables: vars, teamId })));

  it("GETs environment.getEnvironmentWithVariables with Bearer token and returns vars and the team", async () => {
    const f = environment();

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).getEnvironmentWithVariables(envId);

    const req = calledRequest(f);
    expect(req.url).toContain(
      "/api/trpc/environment.getEnvironmentWithVariables",
    );
    expect(req.method).toBe("GET");
    expect(req.auth).toBe(`Bearer ${apiKey}`);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value).toEqual({ environmentVariables: vars, teamId });
  });

  it("passes envId as `id` in the query param", async () => {
    const f = environment();
    await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).getEnvironmentWithVariables(envId);

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
    }).getEnvironmentWithVariables(envId);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/env-vars/i);
  });
});
