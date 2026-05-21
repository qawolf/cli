import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import superjson from "superjson";

import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import { testApiKey, testBaseUrl } from "./pull.fixtures.js";
import { exists } from "./teamStorageAssets.fixtures.js";
import {
  downloadTeamStorageAssets,
  requestTeamStorageFiles,
} from "./teamStorageAssets.js";

let workDir = "";
let assetsDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-team-storage-"));
  assetsDir = join(workDir, "assets");
  await mkdir(assetsDir, { recursive: true });
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

type FetchCall = { url: string; init: RequestInit | undefined };

function makeFetch(): { calls: FetchCall[]; fetch: typeof globalThis.fetch } {
  const calls: FetchCall[] = [];
  const fetch = async (
    input: string | URL | Request,
    init: RequestInit | undefined,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });

    if (url.includes("/api/v0/identity")) {
      return new Response(
        JSON.stringify({
          team: {
            createdAt: "2024-01-01T00:00:00.000Z",
            id: "team_123",
            name: "Test Team",
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("/api/trpc/team.listStorageFiles")) {
      const body = {
        result: {
          data: superjson.serialize({
            files: [
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
            ],
            nextPageToken: undefined,
          }),
        },
      };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url === "https://storage.example.com/root") {
      return new Response("root");
    }
    if (url === "https://storage.example.com/nested") {
      return new Response("nested");
    }

    return new Response("not found", { status: 404 });
  };

  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

describe("requestTeamStorageFiles", () => {
  it("requests team.listStorageFiles with the team id", async () => {
    const fakeFetch = makeFetch();

    const files = await requestTeamStorageFiles({
      platform: createPlatformClient(testApiKey, {
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      }),
    });

    expect(files.map((file) => file.path)).toEqual([
      "root.txt",
      "nested/data.csv",
    ]);
    const call = fakeFetch.calls.find((c) =>
      c.url.includes("/api/trpc/team.listStorageFiles"),
    );
    expect(call?.url).toContain(
      `${testBaseUrl}/api/trpc/team.listStorageFiles`,
    );
    expect(call?.url).toContain(encodeURIComponent('"teamId":"team_123"'));
    expect(call?.url).toContain(
      encodeURIComponent('"excludePrefixes":["_screenshots_/"]'),
    );
    expect(call?.init?.method).toBe("GET");
    const headers = call?.init?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toBe(`Bearer ${testApiKey}`);
  });
});

describe("downloadTeamStorageAssets", () => {
  it("writes files under assets using the storage path layout", async () => {
    const fakeFetch = makeFetch();
    const files = await requestTeamStorageFiles({
      platform: createPlatformClient(testApiKey, {
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      }),
    });

    const result = await downloadTeamStorageAssets(
      { assetsAbs: assetsDir, files },
      { fetch: fakeFetch.fetch },
    );

    expect(result).toEqual({
      downloadedCount: 2,
      reusedCount: 0,
      skippedCount: 0,
    });
    expect(await readFile(join(assetsDir, "root.txt"), "utf8")).toBe("root");
    expect(await readFile(join(assetsDir, "nested", "data.csv"), "utf8")).toBe(
      "nested",
    );
  });

  it("replaces stale assets with the current storage snapshot", async () => {
    await writeFile(join(assetsDir, "stale.txt"), "old");
    await mkdir(join(assetsDir, "stale-dir"), { recursive: true });
    await writeFile(join(assetsDir, "stale-dir", "old.txt"), "old");

    const fakeFetch = makeFetch();
    const files = await requestTeamStorageFiles({
      platform: createPlatformClient(testApiKey, {
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      }),
    });

    const result = await downloadTeamStorageAssets(
      { assetsAbs: assetsDir, files },
      { fetch: fakeFetch.fetch },
    );

    expect(result).toEqual({
      downloadedCount: 2,
      reusedCount: 0,
      skippedCount: 0,
    });
    expect(await exists(join(assetsDir, "stale.txt"))).toBe(false);
    expect(await exists(join(assetsDir, "stale-dir"))).toBe(false);
    expect(await readFile(join(assetsDir, "root.txt"), "utf8")).toBe("root");
    expect(await readFile(join(assetsDir, "nested", "data.csv"), "utf8")).toBe(
      "nested",
    );
  });

  it("skips screenshots, ovpn, directories, and unsafe paths before fetch", async () => {
    const calls: string[] = [];
    const fetch = (async (input: string | URL | Request): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      calls.push(url);
      return new Response("safe");
    }) as unknown as typeof globalThis.fetch;

    const result = await downloadTeamStorageAssets(
      {
        assetsAbs: assetsDir,
        files: [
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
            path: "safe.txt",
            signedUrl: "https://storage.example.com/safe",
            size: 4,
          },
        ],
      },
      { fetch },
    );

    expect(result).toEqual({
      downloadedCount: 1,
      reusedCount: 0,
      skippedCount: 4,
    });
    expect(calls).toEqual(["https://storage.example.com/safe"]);
    expect(await readFile(join(assetsDir, "safe.txt"), "utf8")).toBe("safe");
  });
});
