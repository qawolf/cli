import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import superjson from "superjson";

import { createPlatformClient } from "./createPlatformClient.js";
import type { TeamStorageFile } from "./types.js";

let workDir = "";
let assetsDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-platform-assets-reuse-"));
  assetsDir = join(workDir, "assets");
  await mkdir(assetsDir, { recursive: true });
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("PlatformClient.syncTeamStorageAssets etag reuse", () => {
  it("keeps matching assets in place when etags are unchanged", async () => {
    const files = teamStorageFiles();
    const firstFetch = makeFetch(files);
    await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: firstFetch.fetch,
    }).syncTeamStorageAssets(assetsDir);
    const rootStat = await stat(join(assetsDir, "root.txt"));
    const secondFetch = makeFetch(files, { failAssetFetches: true });

    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: secondFetch.fetch,
    }).syncTeamStorageAssets(assetsDir);

    expect(result).toEqual({
      ok: true,
      value: { downloadedCount: 0, reusedCount: 2, skippedCount: 0 },
    });
    expect(secondFetch.assetUrls).toEqual([]);
    expect((await stat(join(assetsDir, "root.txt"))).mtimeMs).toBe(
      rootStat.mtimeMs,
    );
  });

  it("downloads only changed etags while pruning stale paths", async () => {
    const files = teamStorageFiles();
    await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: makeFetch(files).fetch,
    }).syncTeamStorageAssets(assetsDir);
    await writeFile(join(assetsDir, "stale.txt"), "old");
    const changedFiles = files.map((file) =>
      file.path === "root.txt"
        ? {
            ...file,
            etag: "root-v2",
            signedUrl: "https://storage.example.com/root-v2",
            size: 7,
          }
        : file,
    );
    const fetch = makeFetch(changedFiles);
    const progress: { current: number; total: number }[] = [];

    const result = await createPlatformClient("qawolf_key", {
      baseUrl: "https://test.qawolf.com",
      fetch: fetch.fetch,
    }).syncTeamStorageAssets(assetsDir, {
      onProgress: (p) => progress.push(p),
    });

    expect(result).toEqual({
      ok: true,
      value: { downloadedCount: 1, reusedCount: 1, skippedCount: 0 },
    });
    // Progress counts only real downloads; the reused file is not in the total.
    expect(progress).toEqual([{ current: 1, total: 1 }]);
    expect(fetch.assetUrls).toEqual(["https://storage.example.com/root-v2"]);
    expect(await readFile(join(assetsDir, "root.txt"), "utf8")).toBe("root-v2");
    expect(await readFile(join(assetsDir, "nested", "data.csv"), "utf8")).toBe(
      "nested",
    );
    expect(await exists(join(assetsDir, "stale.txt"))).toBe(false);
  });
});

function teamStorageFiles(): TeamStorageFile[] {
  return [
    {
      etag: "root-v1",
      path: "root.txt",
      signedUrl: "https://storage.example.com/root",
      size: 4,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      etag: "nested-v1",
      path: "nested/data.csv",
      signedUrl: "https://storage.example.com/nested",
      size: 6,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
}

function makeFetch(
  files: TeamStorageFile[],
  opts: { failAssetFetches?: boolean } = {},
): { assetUrls: string[]; fetch: typeof globalThis.fetch } {
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
          data: superjson.serialize({ files, nextPageToken: undefined }),
        },
      });
    }

    assetUrls.push(url);
    if (opts.failAssetFetches === true) {
      return new Response("unexpected", { status: 500 });
    }
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
  if (url.endsWith("/root-v2")) return "root-v2";
  if (url.endsWith("/nested")) return "nested";
  return "unexpected";
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
