import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { pathExists } from "~/shell/fs.js";
import { buildManifest, flattenSingleWrapper } from "./bundle.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-bundle-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("flattenSingleWrapper", () => {
  it("promotes contents up one level and returns the wrapper name", async () => {
    const inner = join(workDir, "wrapper");
    await mkdir(inner, { recursive: true });
    await writeFile(join(inner, "a.flow.ts"), "// a", "utf8");
    await mkdir(join(inner, "nested"));
    await writeFile(join(inner, "nested/b.flow.ts"), "// b", "utf8");

    const wrapperName = await flattenSingleWrapper(workDir);

    expect(wrapperName).toBe("wrapper");
    expect(await pathExists(join(workDir, "a.flow.ts"))).toBe(true);
    expect(await pathExists(join(workDir, "nested/b.flow.ts"))).toBe(true);
    expect(await pathExists(join(workDir, "wrapper"))).toBe(false);
  });

  it("returns undefined and leaves dir alone when it contains multiple entries", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "// a", "utf8");
    await mkdir(join(workDir, "nested"));

    expect(await flattenSingleWrapper(workDir)).toBeUndefined();
    expect(await pathExists(join(workDir, "a.flow.ts"))).toBe(true);
    expect(await pathExists(join(workDir, "nested"))).toBe(true);
  });

  it("returns undefined when the single entry is a file", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "// a", "utf8");

    expect(await flattenSingleWrapper(workDir)).toBeUndefined();
    expect(await pathExists(join(workDir, "a.flow.ts"))).toBe(true);
  });

  it("returns undefined for an empty dir", async () => {
    expect(await flattenSingleWrapper(workDir)).toBeUndefined();
  });
});

describe("buildManifest", () => {
  async function stage(opts: {
    flows: { name: string; data: string }[];
  }): Promise<void> {
    for (const f of opts.flows) {
      const p = join(workDir, f.name);
      await mkdir(join(p, ".."), { recursive: true });
      await writeFile(p, f.data, "utf8");
    }
  }

  const baseArgs = (): {
    envId: string;
    bundleDir: string;
    cliFlowsVersion: string;
    now: Date;
    envVarsFetchedAt: Date | undefined;
    wrapperName: string | undefined;
  } => ({
    envId: "env-x",
    bundleDir: workDir,
    cliFlowsVersion: "0.4.0",
    now: new Date("2026-05-10T12:00:00.000Z"),
    envVarsFetchedAt: undefined,
    wrapperName: undefined,
  });

  it("walks .flow.ts and .flow.js files, ignores other extensions", async () => {
    await stage({
      flows: [
        { name: "a.flow.ts", data: "// a" },
        { name: "nested/b.flow.js", data: "// b" },
        { name: "c.txt", data: "ignored" },
        { name: "d.flow.json", data: "ignored" },
      ],
    });

    const manifest = await buildManifest(baseArgs());

    expect(manifest.flows.map((f) => f.path).sort()).toEqual([
      "a.flow.ts",
      "nested/b.flow.js",
    ]);
    expect(manifest.flows[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("extracts qawolfCommitSha from a GitHub-archive wrapper directory name", async () => {
    await stage({ flows: [{ name: "a.flow.ts", data: "// a" }] });
    const sha = "c67b5b6ff48766ca3cd72ceb4037e95c49633725";
    const manifest = await buildManifest({
      ...baseArgs(),
      wrapperName: `chases-code-and-audio-jam-chases-code-and-audio-jam-${sha}`,
    });
    expect(manifest.qawolfCommitSha).toBe(sha);
  });

  it("returns qawolfCommitSha as undefined when the wrapper name has no trailing 40-hex segment", async () => {
    await stage({ flows: [{ name: "a.flow.ts", data: "// a" }] });
    const manifest = await buildManifest({
      ...baseArgs(),
      wrapperName: "some-non-github-wrapper-name",
    });
    expect(manifest.qawolfCommitSha).toBeUndefined();
  });

  it("returns qawolfCommitSha as undefined when no wrapper directory existed", async () => {
    await stage({ flows: [{ name: "a.flow.ts", data: "// a" }] });
    const manifest = await buildManifest(baseArgs());
    expect(manifest.qawolfCommitSha).toBeUndefined();
  });

  it("samples any flow file's mtime as qawolfCommittedAt", async () => {
    await stage({ flows: [{ name: "a.flow.ts", data: "// a" }] });
    const manifest = await buildManifest(baseArgs());
    expect(manifest.qawolfCommittedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("returns qawolfCommittedAt as undefined when the bundle has no flows", async () => {
    await stage({ flows: [] });
    const manifest = await buildManifest(baseArgs());
    expect(manifest.qawolfCommittedAt).toBeUndefined();
  });

  it("captures envId, fetchedAt, and CLI version on the manifest", async () => {
    await stage({ flows: [{ name: "a.flow.ts", data: "// a" }] });

    const manifest = await buildManifest(baseArgs());

    expect(manifest.envId).toBe("env-x");
    expect(manifest.fetchedAt).toBe("2026-05-10T12:00:00.000Z");
    expect(manifest.cliFlowsVersion).toBe("0.4.0");
    expect(manifest.envSlug).toBeUndefined();
  });
});
