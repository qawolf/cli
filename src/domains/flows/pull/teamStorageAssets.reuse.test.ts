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

import { createPlatformClient } from "~/shell/platform/createPlatformClient.js";
import { testApiKey, testBaseUrl } from "./pull.fixtures.js";
import { exists, inputToUrl, makeFetch } from "./teamStorageAssets.fixtures.js";
import {
  downloadTeamStorageAssets,
  requestTeamStorageFiles,
} from "./teamStorageAssets.js";

let workDir = "";
let assetsDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-team-storage-reuse-"));
  assetsDir = join(workDir, "assets");
  await mkdir(assetsDir, { recursive: true });
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("downloadTeamStorageAssets etag reuse", () => {
  it("keeps matching assets in place when etags are unchanged", async () => {
    const fakeFetch = makeFetch();
    const files = await requestTeamStorageFiles({
      platform: createPlatformClient(testApiKey, {
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      }),
    });
    await downloadTeamStorageAssets(
      { assetsAbs: assetsDir, files },
      { fetch: fakeFetch.fetch },
    );
    const rootStat = await stat(join(assetsDir, "root.txt"));
    const calls: string[] = [];
    const fetch = (async (input: string | URL | Request): Promise<Response> => {
      calls.push(inputToUrl(input));
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof globalThis.fetch;

    const result = await downloadTeamStorageAssets(
      { assetsAbs: assetsDir, files },
      { fetch },
    );

    expect(result).toEqual({
      downloadedCount: 0,
      reusedCount: 2,
      skippedCount: 0,
    });
    expect(calls).toEqual([]);
    expect((await stat(join(assetsDir, "root.txt"))).mtimeMs).toBe(
      rootStat.mtimeMs,
    );
  });

  it("downloads only changed etags while pruning stale paths", async () => {
    const fakeFetch = makeFetch();
    const files = await requestTeamStorageFiles({
      platform: createPlatformClient(testApiKey, {
        baseUrl: testBaseUrl,
        fetch: fakeFetch.fetch,
      }),
    });
    await downloadTeamStorageAssets(
      { assetsAbs: assetsDir, files },
      { fetch: fakeFetch.fetch },
    );
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
    const calls: string[] = [];
    const fetch = (async (input: string | URL | Request): Promise<Response> => {
      const url = inputToUrl(input);
      calls.push(url);
      if (url === "https://storage.example.com/root-v2") {
        return new Response("root-v2");
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof globalThis.fetch;

    const result = await downloadTeamStorageAssets(
      { assetsAbs: assetsDir, files: changedFiles },
      { fetch },
    );

    expect(result).toEqual({
      downloadedCount: 1,
      reusedCount: 1,
      skippedCount: 0,
    });
    expect(calls).toEqual(["https://storage.example.com/root-v2"]);
    expect(await readFile(join(assetsDir, "root.txt"), "utf8")).toBe("root-v2");
    expect(await readFile(join(assetsDir, "nested", "data.csv"), "utf8")).toBe(
      "nested",
    );
    expect(await exists(join(assetsDir, "stale.txt"))).toBe(false);
  });
});
