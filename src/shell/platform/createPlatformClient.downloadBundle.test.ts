import { rm, stat } from "node:fs/promises";
import { afterEach, describe, expect, it, mock } from "bun:test";
import superjson from "superjson";

import { createPlatformClient } from "./createPlatformClient.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_key";
const envId = "env-abc";
const signedUrl = "https://storage.example.com/bundle.tar.gz?sig=x";

function trpcWrapped(value: unknown) {
  return { result: { data: superjson.serialize(value) } };
}

function makeSequenceFetch(
  responses: { url: string; response: Response | Error }[],
): typeof fetch {
  let i = 0;
  return (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const entry = responses.find((r) => url.includes(r.url));
    if (!entry) return new Response("not found", { status: 404 });
    i++;
    if (entry.response instanceof Error) throw entry.response;
    return entry.response;
  }) as unknown as typeof fetch;
}

describe("downloadBundle", () => {
  it("resolves the signed URL, downloads, and returns a tmp archive path", async () => {
    const bundleBytes = new Uint8Array([1, 2, 3, 4]);
    const f = makeSequenceFetch([
      {
        url: "/api/trpc/gitwolf.getFlowsBundleUrl",
        response: new Response(
          JSON.stringify(
            trpcWrapped({
              url: signedUrl,
              expiresAt: "2099-12-31T00:00:00.000Z",
            }),
          ),
          { headers: { "content-type": "application/json" } },
        ),
      },
      {
        url: signedUrl,
        response: new Response(bundleBytes),
      },
    ]);

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).downloadBundle(envId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    try {
      expect(result.value.tmpArchive).toMatch(
        /qawolf-pull-[0-9a-f]+\.tar\.gz$/,
      );
      const s = await stat(result.value.tmpArchive);
      expect(s.size).toBe(bundleBytes.length);
    } finally {
      await rm(result.value.tmpArchive, { force: true });
    }
  });

  it("returns ok:false when the bundle URL request fails (404)", async () => {
    const f = (async () =>
      new Response("not found", {
        status: 404,
      })) as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: async () => {},
    }).downloadBundle(envId);

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatch(/could not find that environment/i);
  });

  it("returns ok:false with expired-link message when the download returns 403", async () => {
    const f = makeSequenceFetch([
      {
        url: "/api/trpc/gitwolf.getFlowsBundleUrl",
        response: new Response(
          JSON.stringify(
            trpcWrapped({
              url: signedUrl,
              expiresAt: "2099-12-31T00:00:00.000Z",
            }),
          ),
          { headers: { "content-type": "application/json" } },
        ),
      },
      {
        url: signedUrl,
        response: new Response("<Error>SignatureExpired</Error>", {
          status: 403,
        }),
      },
    ]);

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
    }).downloadBundle(envId);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expired|run.+pull.+again/i);
  });
});
