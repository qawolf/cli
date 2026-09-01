import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { hashFile, writeManifest } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";
import { buildBundle } from "./pull.fixtures.js";
import { checkSafety } from "./pull.js";
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

describe("safety + staging integration", () => {
  it("overwrites the locally-modified file when --yes and staging runs", async () => {
    await mkdir(destDir, { recursive: true });
    await writeFile(join(destDir, "a.flow.ts"), "original", "utf8");
    const manifest: Manifest = {
      envId: "env-abc",
      envSlug: undefined,
      fetchedAt: "2026-05-09T00:00:00.000Z",
      envVarsFetchedAt: undefined,
      cliFlowsVersion: "0.4.0",
      qawolfCommitSha: undefined,
      qawolfCommittedAt: undefined,
      tagsFetchedAt: undefined,
      flows: [
        {
          path: "a.flow.ts",
          contentHash: await hashFile(join(destDir, "a.flow.ts")),
          tags: undefined,
        },
      ],
    };
    await writeManifest(destDir, manifest);
    await writeFile(join(destDir, "a.flow.ts"), "edited locally", "utf8");

    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "original" }],
    });

    const safety = await checkSafety({
      envDir: destDir,
      yes: true,
      log: () => {},
      confirm: async () => false,
    });
    expect(safety).toBe("proceed");

    await stageBundle({
      tmpArchive: bundleArchive,
      destAbs: destDir,
      assetsAbs: join(destDir, "..", "assets"),
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
      tags: undefined,
    });

    expect(await readFile(join(destDir, "a.flow.ts"), "utf8")).toBe("original");
  });
});
