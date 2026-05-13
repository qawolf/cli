import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { type Manifest, hashFile, writeManifest } from "./manifest.js";
import { buildBundle, makeFakeFetch } from "./pull.fixtures.js";
import { checkSafety, downloadBundle, requestBundle } from "./pull.js";
import { stageBundle } from "./stage.js";

let workDir = "";
let bundleArchive = "";
let destDir = "";
const tmpArchives: string[] = [];

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-pull-safety-"));
  bundleArchive = join(workDir, "bundle.tar.gz");
  destDir = join(workDir, "dest");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
  await Promise.all(tmpArchives.splice(0).map((a) => rm(a, { force: true })));
});

describe("safety + staging integration", () => {
  it("overwrites the locally-modified file when --yes and staging runs", async () => {
    await mkdir(destDir, { recursive: true });
    await writeFile(join(destDir, "a.flow.ts"), "original", "utf8");
    const manifest: Manifest = {
      envId: "env-abc",
      envSlug: undefined,
      fetchedAt: "2026-05-09T00:00:00.000Z",
      cliFlowsVersion: "0.4.0",
      bundleFlowsVersion: "0.5.0",
      files: [
        {
          path: "a.flow.ts",
          sha256: await hashFile(join(destDir, "a.flow.ts")),
        },
      ],
    };
    await writeManifest(destDir, manifest);
    await writeFile(join(destDir, "a.flow.ts"), "edited locally", "utf8");

    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "original" }],
      bundleFlowsVersion: "0.5.0",
    });

    const safety = await checkSafety({
      envDir: destDir,
      yes: true,
      log: () => {},
      confirm: async () => false,
    });
    expect(safety).toBe("proceed");

    const fakeFetch = makeFakeFetch({
      kind: "ok",
      sourceArchive: bundleArchive,
    });
    const { signedUrl } = await requestBundle(
      { apiKey: "k", baseUrl: "https://t.x", fetch: fakeFetch.fetch },
      "env-abc",
    );
    const { tmpArchive } = await downloadBundle(
      { fetch: fakeFetch.fetch },
      signedUrl,
    );
    tmpArchives.push(tmpArchive);

    await stageBundle({
      tmpArchive,
      destAbs: destDir,
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(await readFile(join(destDir, "a.flow.ts"), "utf8")).toBe("original");
  });
});
