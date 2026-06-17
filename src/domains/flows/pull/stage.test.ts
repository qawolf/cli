import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makeDefaultFs } from "~/shell/fs.js";
import { readManifest } from "~/shell/manifest/io.js";
import { buildBundle } from "./pull.fixtures.js";
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

describe("stageBundle", () => {
  it("extracts flows, writes manifest, and atomically swaps into destDir", async () => {
    await buildBundle(bundleArchive, {
      flows: [
        { name: "checkout.flow.ts", data: "// checkout\n" },
        { name: "nested/login.flow.ts", data: "// login\n" },
      ],
    });

    const result = await stageBundle({
      tmpArchive: bundleArchive,
      destAbs: destDir,
      assetsAbs: join(workDir, "assets"),
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(result).toEqual({
      envDir: destDir,
      flowCount: 2,
      envVarCount: 1,
      flowsWithTeamStorageRefs: [],
    });
    expect(await readFile(join(destDir, "checkout.flow.ts"), "utf8")).toBe(
      "// checkout\n",
    );

    const manifest = await readManifest(destDir);
    if (manifest === "missing" || manifest === "malformed") {
      throw new Error("manifest should be present");
    }
    expect(manifest.flows.map((f) => f.path).sort()).toEqual([
      "checkout.flow.ts",
      "nested/login.flow.ts",
    ]);
  });

  it("flattens a single content-hash wrapper directory", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.js", data: "// a\n" }],
      wrapInDir: "garden-x-y-abc123",
    });

    const result = await stageBundle({
      tmpArchive: bundleArchive,
      destAbs: destDir,
      assetsAbs: join(workDir, "assets"),
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(result.flowCount).toBe(1);
    expect(await readFile(join(destDir, "a.flow.js"), "utf8")).toBe("// a\n");
    expect(
      await makeDefaultFs().pathExists(join(destDir, "garden-x-y-abc123")),
    ).toBe(false);
  });

  it("records qawolfCommitSha when the wrapper has a GitHub-style SHA suffix", async () => {
    const sha = "c67b5b6ff48766ca3cd72ceb4037e95c49633725";
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "// a\n" }],
      wrapInDir: `chases-code-and-audio-jam-chases-code-and-audio-jam-${sha}`,
    });

    await stageBundle({
      tmpArchive: bundleArchive,
      destAbs: destDir,
      assetsAbs: join(workDir, "assets"),
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: {},
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
    });

    const manifest = await readManifest(destDir);
    if (manifest === "missing" || manifest === "malformed") {
      throw new Error("manifest should be present");
    }
    expect(manifest.qawolfCommitSha).toBe(sha);
    expect(manifest.qawolfCommittedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("writes env vars to .env with mode 0600 and records envVarsFetchedAt", async () => {
    await buildBundle(bundleArchive, {
      flows: [{ name: "a.flow.ts", data: "// a\n" }],
    });
    const fetchedAt = new Date("2026-05-10T12:30:00.000Z");
    const assetsAbs = join(workDir, "assets");

    const result = await stageBundle({
      tmpArchive: bundleArchive,
      destAbs: destDir,
      assetsAbs,
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: { BASE_URL: "https://example.com", TOKEN: "abc" },
      envVarsFetchedAt: fetchedAt,
    });

    expect(result.envVarCount).toBe(3);
    expect(await readFile(join(destDir, ".env"), "utf8")).toBe(
      `BASE_URL="https://example.com"\nTEAM_STORAGE_DIR="${assetsAbs}"\nTOKEN="abc"\n`,
    );
    const stats = await stat(join(destDir, ".env"));
    expect(stats.mode & 0o777).toBe(0o600);

    const manifest = await readManifest(destDir);
    if (manifest === "missing" || manifest === "malformed") {
      throw new Error("manifest should be present");
    }
    expect(manifest.envVarsFetchedAt).toBe(fetchedAt.toISOString());
  });

  it("rewrites literal /home/wolf/team-storage/ references and injects TEAM_STORAGE_DIR", async () => {
    await buildBundle(bundleArchive, {
      flows: [
        {
          name: "upload.flow.ts",
          data:
            "import { flow } from '@qawolf/flows/web';\n" +
            "export default flow('upload', 'Web - Chrome', async () => {\n" +
            "  const path = `/home/wolf/team-storage/${dataset}`;\n" +
            "});\n",
        },
        {
          name: "envvar.flow.ts",
          data: "const p = `${process.env.TEAM_STORAGE_DIR}/${name}.fig`;\n",
        },
      ],
    });
    const assetsDir = join(workDir, "assets");

    const stageResult = await stageBundle({
      tmpArchive: bundleArchive,
      destAbs: destDir,
      assetsAbs: assetsDir,
      envId: "env-abc",
      cliFlowsVersion: "0.4.0",
      now: new Date("2026-05-10T12:00:00.000Z"),
      envVars: { TEAM_STORAGE_DIR: "/home/wolf/team-storage" },
      envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
    });

    expect(stageResult.flowsWithTeamStorageRefs).toEqual([
      "envvar.flow.ts",
      "upload.flow.ts",
    ]);

    // The literal-mount-path flow has been rewritten.
    expect(await readFile(join(destDir, "upload.flow.ts"), "utf8")).toContain(
      "${process.env.TEAM_STORAGE_DIR}/${dataset}",
    );
    expect(
      await readFile(join(destDir, "upload.flow.ts"), "utf8"),
    ).not.toContain("/home/wolf/team-storage/");
    // The env-var-shape flow is untouched.
    expect(await readFile(join(destDir, "envvar.flow.ts"), "utf8")).toBe(
      "const p = `${process.env.TEAM_STORAGE_DIR}/${name}.fig`;\n",
    );
    // The written .env overrides the API's TEAM_STORAGE_DIR with assetsAbs.
    const envContents = await readFile(join(destDir, ".env"), "utf8");
    expect(envContents).toContain(`TEAM_STORAGE_DIR="${assetsDir}"`);
    expect(envContents).not.toContain(
      `TEAM_STORAGE_DIR="/home/wolf/team-storage"`,
    );
  });
});
