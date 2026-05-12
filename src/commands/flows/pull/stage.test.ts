import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { pathExists } from "~/lib/fs.js";
import { readManifest } from "./manifest.js";
import { buildBundle, makeFakeFetch } from "./pull.fixtures.js";
import { downloadBundle, requestBundle } from "./pull.js";
import { stageBundle } from "./stage.js";

let workDir = "";
let bundleArchive = "";
let destDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-stage-"));
  bundleArchive = join(workDir, "bundle.tar.gz");
  destDir = join(workDir, "dest");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

// stageBundle expects a real tmp archive on disk. The simplest path to one
// is to drive the fixture's fake fetch through requestBundle + downloadBundle.
async function prepArchive(): Promise<string> {
  const fakeFetch = makeFakeFetch({ kind: "ok", sourceArchive: bundleArchive });
  const { signedUrl } = await requestBundle(
    { apiKey: "k", baseUrl: "https://t.x", fetch: fakeFetch.fetch },
    "env-abc",
  );
  const { tmpArchive } = await downloadBundle(
    { fetch: fakeFetch.fetch },
    signedUrl,
  );
  return tmpArchive;
}

describe("stageBundle", () => {
  it("extracts flows, writes manifest, and atomically swaps into destDir", async () => {
    await buildBundle(bundleArchive, {
      flows: [
        { name: "checkout.flow.ts", data: "// checkout\n" },
        { name: "nested/login.flow.ts", data: "// login\n" },
      ],
      bundleFlowsVersion: "0.5.0",
    });
    const archive = await prepArchive();

    const result = await stageBundle({
      tmpArchive: archive,
      destAbs: destDir,
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(result).toEqual({
      envDir: destDir,
      flowCount: 2,
      bundleFlowsVersion: "0.5.0",
    });
    expect(await readFile(join(destDir, "checkout.flow.ts"), "utf8")).toBe(
      "// checkout\n",
    );

    const manifest = await readManifest(destDir);
    if (manifest === "missing" || manifest === "malformed") {
      throw new Error("manifest should be present");
    }
    expect(manifest.files.map((f) => f.path).sort()).toEqual([
      "checkout.flow.ts",
      "nested/login.flow.ts",
    ]);
  });

  it("flattens a single content-hash wrapper directory", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.js", data: "// a\n" }],
      bundleFlowsVersion: "0.5.0",
      wrapInDir: "garden-x-y-abc123",
    });
    const archive = await prepArchive();

    const result = await stageBundle({
      tmpArchive: archive,
      destAbs: destDir,
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(result.flowCount).toBe(1);
    expect(await readFile(join(destDir, "a.flow.js"), "utf8")).toBe("// a\n");
    expect(await pathExists(join(destDir, "garden-x-y-abc123"))).toBe(false);
  });

  it("records bundleFlowsVersion as undefined when bundle has no pin", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.js", data: "// a\n" }],
      // bundleFlowsVersion intentionally omitted
    });
    const archive = await prepArchive();

    const result = await stageBundle({
      tmpArchive: archive,
      destAbs: destDir,
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(result.bundleFlowsVersion).toBeUndefined();

    const manifest = await readManifest(destDir);
    if (manifest === "missing" || manifest === "malformed") {
      throw new Error("manifest should be present");
    }
    expect(manifest.bundleFlowsVersion).toBeUndefined();
  });
});
