import { afterEach, describe, expect, it, mock, type Mock } from "bun:test";
import superjson from "superjson";

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

function trpcWrapped(value: unknown) {
  return { result: { data: superjson.serialize(value) } };
}

const emptyFileList = trpcWrapped({ files: [], nextPageToken: undefined });

// The mock records `RequestInfo | URL`; every call here passes a string URL,
// so narrow once at this boundary rather than at each assertion.
function requestedUrls(f: typeof fetch): string[] {
  return (f as unknown as Mock<typeof fetch>).mock.calls.map(
    ([url]) => url as string,
  );
}

// mock() cannot express fetch's overloads; build against a loose signature and
// cast once, as the sibling platform tests do.
function conditionalFetch(respond: (url: string) => Response): typeof fetch {
  return mock((input: unknown) =>
    Promise.resolve(respond(String(input as string))),
  ) as unknown as typeof fetch;
}

describe("listTeamStorageFiles", () => {
  // A browser session's identity names an organization and no team, so reading
  // it first refused every such session. The workspace it chose is the team.
  it("uses the session's workspace as the team, without probing identity", async () => {
    const fetchMock = mock<typeof fetch>().mockResolvedValue(
      json(emptyFileList),
    ) as unknown as typeof fetch;
    const client = createPlatformClient(apiKey, {
      fetch: fetchMock,
      baseUrl,
      sleep: noSleep,
      workspaceId: "goer6sm4opv6to8ys1jc6ojaotea",
    });

    const result = await client.listTeamStorageFiles();

    expect(result.ok).toBe(true);
    const urls = requestedUrls(fetchMock);
    expect(urls[0]).toContain("team.listStorageFiles");
    expect(decodeURIComponent(urls[0] ?? "")).toContain(
      "goer6sm4opv6to8ys1jc6ojaotea",
    );
    // The identity endpoint must not be reached at all.
    expect(urls.some((u) => u.includes("/api/v0/identity"))).toBe(false);
  });

  it("falls back to a team API key's own identity", async () => {
    const fetchMock = conditionalFetch((url) =>
      url.includes("/api/v0/identity")
        ? json({
            team: { createdAt: "2026-01-01", id: "team-from-key", name: "T" },
          })
        : json(emptyFileList),
    );
    const client = createPlatformClient(apiKey, {
      fetch: fetchMock,
      baseUrl,
      sleep: noSleep,
    });

    const result = await client.listTeamStorageFiles();

    expect(result.ok).toBe(true);
    const storageUrl = requestedUrls(fetchMock).find((u) =>
      u.includes("team.listStorageFiles"),
    );
    expect(decodeURIComponent(storageUrl ?? "")).toContain("team-from-key");
  });

  // An organization key reaches many teams and names none, so there is nothing
  // to fall back on.
  it("refuses an organization key with no workspace chosen", async () => {
    const fetchMock = mock<typeof fetch>().mockResolvedValue(
      json({ organization: { id: "org-1", name: "Org" } }),
    ) as unknown as typeof fetch;
    const client = createPlatformClient(apiKey, {
      fetch: fetchMock,
      baseUrl,
      sleep: noSleep,
    });

    const result = await client.listTeamStorageFiles();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.error).toContain("team API key");
  });
});
