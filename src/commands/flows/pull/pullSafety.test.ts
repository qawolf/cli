import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { type Manifest, hashFile } from "./manifest.js";
import { buildBundle, makeFakeFetch } from "./pull.fixtures.js";
import { checkSafety, downloadBundle, requestBundle } from "./pull.js";
import { stageBundle } from "./stage.js";

let workDir = "";
let bundleArchive = "";
let destDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-pull-safety-"));
  bundleArchive = join(workDir, "bundle.tar.gz");
  destDir = join(workDir, "dest");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function setupExistingEnv(modifyFlow: boolean): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await writeFile(join(destDir, "a.flow.ts"), "original", "utf8");
  const sha = await hashFile(join(destDir, "a.flow.ts"));
  const manifest: Manifest = {
    envId: "env-abc",
    envSlug: undefined,
    fetchedAt: "2026-05-09T00:00:00.000Z",
    cliFlowsVersion: "0.4.0",
    bundleFlowsVersion: "0.5.0",
    files: [{ path: "a.flow.ts", sha256: sha }],
  };
  await writeFile(
    join(destDir, ".manifest.json"),
    JSON.stringify(manifest, undefined, 2),
    "utf8",
  );

  if (modifyFlow) {
    await writeFile(join(destDir, "a.flow.ts"), "edited locally", "utf8");
  }
}

describe("checkSafety", () => {
  it("proceeds without prompt when no manifest exists at destDir", async () => {
    await mkdir(destDir, { recursive: true });
    let confirmCalled = false;
    const result = await checkSafety({
      envDir: destDir,
      yes: false,
      log: () => {},
      confirm: async () => {
        confirmCalled = true;
        return true;
      },
    });
    expect(result).toBe("proceed");
    expect(confirmCalled).toBe(false);
  });

  it("returns 'abort' when user declines on local mods", async () => {
    await setupExistingEnv(true);
    const result = await checkSafety({
      envDir: destDir,
      yes: false,
      log: () => {},
      confirm: async () => false,
    });
    expect(result).toBe("abort");
  });

  it("returns 'proceed' with --yes even when local mods exist", async () => {
    await setupExistingEnv(true);
    let confirmCalled = false;
    const result = await checkSafety({
      envDir: destDir,
      yes: true,
      log: () => {},
      confirm: async () => {
        confirmCalled = true;
        return false;
      },
    });
    expect(result).toBe("proceed");
    expect(confirmCalled).toBe(false);
  });

  it("returns 'proceed' when user accepts the prompt", async () => {
    await setupExistingEnv(true);
    const result = await checkSafety({
      envDir: destDir,
      yes: false,
      log: () => {},
      confirm: async () => true,
    });
    expect(result).toBe("proceed");
  });
});

describe("safety + staging integration", () => {
  it("leaves locally-modified file alone when checkSafety aborts", async () => {
    await setupExistingEnv(true);

    const result = await checkSafety({
      envDir: destDir,
      yes: false,
      log: () => {},
      confirm: async () => false,
    });
    expect(result).toBe("abort");

    expect(await readFile(join(destDir, "a.flow.ts"), "utf8")).toBe(
      "edited locally",
    );
  });

  it("overwrites the locally-modified file when --yes and staging runs", async () => {
    await setupExistingEnv(true);
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
