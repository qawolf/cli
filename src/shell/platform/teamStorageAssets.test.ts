import { beforeEach, describe, expect, it } from "bun:test";
import superjson from "superjson";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import { createPlatformClient } from "./createPlatformClient.js";

let fs: Fs;
const assetsDir = "/assets";

beforeEach(async () => {
  fs = makeMemoryFs();
  await fs.mkdir(assetsDir, { recursive: true });
});

describe("PlatformClient.syncTeamStorageAssets", () => {
  it("lists and downloads safe assets through the platform client", async () => {
    const fakeFetch = makeFetch([
      {
        path: "root.txt",
        signedUrl: "https://storage.example.com/root",
        size: 4,
      },
      {
        path: "nested/data.csv",
        signedUrl: "https://storage.example.com/nested",
        size: 6,
      },
    ]);

    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: fakeFetch.fetch,
      fs,
    }).syncTeamStorageAssets(assetsDir);

    expect(result).toEqual({
      ok: true,
      value: { downloadedCount: 2, reusedCount: 0, skippedCount: 0 },
    });
    expect(await fs.readFile("/assets/root.txt")).toBe("root");
    expect(await fs.readFile("/assets/nested/data.csv")).toBe("nested");
  });

  it("writes downloaded assets through the platform fs dependency", async () => {
    const fakeFetch = makeFetch([
      {
        path: "root.txt",
        signedUrl: "https://storage.example.com/root",
        size: 4,
      },
    ]);

    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: fakeFetch.fetch,
      fs,
    }).syncTeamStorageAssets("/assets");

    expect(result).toEqual({
      ok: true,
      value: { downloadedCount: 1, reusedCount: 0, skippedCount: 0 },
    });
    expect(await fs.readFile("/assets/root.txt")).toBe("root");
  });

  it("replaces stale assets with the current storage snapshot", async () => {
    await fs.writeFile("/assets/stale.txt", "old");
    await fs.mkdir("/assets/stale-dir", { recursive: true });
    await fs.writeFile("/assets/stale-dir/old.txt", "old");
    const fakeFetch = makeFetch([
      {
        path: "root.txt",
        signedUrl: "https://storage.example.com/root",
        size: 4,
      },
    ]);

    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: fakeFetch.fetch,
      fs,
    }).syncTeamStorageAssets(assetsDir);

    expect(result).toEqual({
      ok: true,
      value: { downloadedCount: 1, reusedCount: 0, skippedCount: 0 },
    });
    expect(await fs.pathExists("/assets/stale.txt")).toBe(false);
    expect(await fs.pathExists("/assets/stale-dir")).toBe(false);
    expect(await fs.readFile("/assets/root.txt")).toBe("root");
  });

  it("skips unsupported paths without fetching their signed urls", async () => {
    const fakeFetch = makeFetch([
      {
        path: "_screenshots_/expected.png",
        signedUrl: "https://storage.example.com/screenshot",
        size: 1,
      },
      {
        path: "vpn/client.ovpn",
        signedUrl: "https://storage.example.com/ovpn",
        size: 1,
      },
      {
        path: "C:/Windows/system32/config",
        signedUrl: "https://storage.example.com/windows",
        size: 1,
      },
      {
        path: "folders/",
        signedUrl: "https://storage.example.com/folder",
        size: 0,
      },
      {
        path: "../escape.txt",
        signedUrl: "https://storage.example.com/escape",
        size: 1,
      },
      {
        path: "ovpn/readme.txt",
        signedUrl: "https://storage.example.com/ovpn-readme",
        size: 6,
      },
      {
        path: "bad\0name.txt",
        signedUrl: "https://storage.example.com/null-byte",
        size: 1,
      },
      {
        path: "safe.txt",
        signedUrl: "https://storage.example.com/safe",
        size: 4,
      },
    ]);

    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: fakeFetch.fetch,
      fs,
    }).syncTeamStorageAssets(assetsDir);

    expect(result).toEqual({
      ok: true,
      value: { downloadedCount: 1, reusedCount: 0, skippedCount: 7 },
    });
    expect(fakeFetch.assetUrls).toEqual(["https://storage.example.com/safe"]);
    expect(await fs.readFile("/assets/safe.txt")).toBe("safe");
  });
});

type TeamStorageFile = {
  path: string;
  signedUrl: string;
  size: number;
};

function makeFetch(files: TeamStorageFile[]): {
  assetUrls: string[];
  fetch: typeof globalThis.fetch;
} {
  const assetUrls: string[] = [];
  const fetch = async (input: string | URL | Request): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/api/v0/identity")) {
      return json({
        team: {
          createdAt: "2024-01-01T00:00:00.000Z",
          id: "team_123",
          name: "Test Team",
        },
      });
    }

    if (url.includes("/api/trpc/team.listStorageFiles")) {
      return json({
        result: {
          data: superjson.serialize({
            files,
            nextPageToken: undefined,
          }),
        },
      });
    }

    assetUrls.push(url);
    return new Response(assetBody(url));
  };

  return { assetUrls, fetch: fetch as unknown as typeof globalThis.fetch };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function assetBody(url: string): string {
  if (url.endsWith("/root")) return "root";
  if (url.endsWith("/nested")) return "nested";
  if (url.endsWith("/ovpn-readme")) return "readme";
  if (url.endsWith("/safe")) return "safe";
  return "unexpected";
}
