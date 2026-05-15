import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { pathExists } from "~/lib/fs.js";
import { buildManifest, flattenSingleWrapper } from "./bundle.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-bundle-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("flattenSingleWrapper", () => {
  it("promotes contents up one level when dir contains a single subdirectory", async () => {
    const inner = join(workDir, "wrapper");
    await mkdir(inner, { recursive: true });
    await writeFile(join(inner, "a.flow.ts"), "// a", "utf8");
    await mkdir(join(inner, "nested"));
    await writeFile(join(inner, "nested/b.flow.ts"), "// b", "utf8");

    await flattenSingleWrapper(workDir);

    expect(await pathExists(join(workDir, "a.flow.ts"))).toBe(true);
    expect(await pathExists(join(workDir, "nested/b.flow.ts"))).toBe(true);
    expect(await pathExists(join(workDir, "wrapper"))).toBe(false);
  });

  it("leaves dir alone when it contains multiple entries", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "// a", "utf8");
    await mkdir(join(workDir, "nested"));

    await flattenSingleWrapper(workDir);

    expect(await pathExists(join(workDir, "a.flow.ts"))).toBe(true);
    expect(await pathExists(join(workDir, "nested"))).toBe(true);
  });

  it("leaves dir alone when its single entry is a file", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "// a", "utf8");

    await flattenSingleWrapper(workDir);

    expect(await pathExists(join(workDir, "a.flow.ts"))).toBe(true);
  });

  it("is a no-op for an empty dir", async () => {
    await flattenSingleWrapper(workDir);
    // no error thrown; nothing to assert beyond reaching this point
  });
});

describe("buildManifest", () => {
  async function stage(opts: {
    flows: { name: string; data: string }[];
    pkg: object;
  }): Promise<void> {
    for (const f of opts.flows) {
      const p = join(workDir, f.name);
      await mkdir(join(p, ".."), { recursive: true });
      await writeFile(p, f.data, "utf8");
    }
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify(opts.pkg),
      "utf8",
    );
  }

  const baseArgs = (): {
    envId: string;
    bundleDir: string;
    cliFlowsVersion: string;
    now: Date;
    envVarsFetchedAt: Date | undefined;
  } => ({
    envId: "env-x",
    bundleDir: workDir,
    cliFlowsVersion: "0.4.0",
    now: new Date("2026-05-10T12:00:00.000Z"),
    envVarsFetchedAt: undefined,
  });

  it("walks .flow.ts and .flow.js files, ignores other extensions", async () => {
    await stage({
      flows: [
        { name: "a.flow.ts", data: "// a" },
        { name: "nested/b.flow.js", data: "// b" },
        { name: "c.txt", data: "ignored" },
        { name: "d.flow.json", data: "ignored" },
      ],
      pkg: { dependencies: { "@qawolf/flows": "1.2.3" } },
    });

    const manifest = await buildManifest(baseArgs());

    expect(manifest.files.map((f) => f.path).sort()).toEqual([
      "a.flow.ts",
      "nested/b.flow.js",
    ]);
    expect(manifest.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("captures envId, fetchedAt, and CLI version on the manifest", async () => {
    await stage({
      flows: [{ name: "a.flow.ts", data: "// a" }],
      pkg: { dependencies: { "@qawolf/flows": "1.2.3" } },
    });

    const manifest = await buildManifest(baseArgs());

    expect(manifest.envId).toBe("env-x");
    expect(manifest.fetchedAt).toBe("2026-05-10T12:00:00.000Z");
    expect(manifest.cliFlowsVersion).toBe("0.4.0");
    expect(manifest.envSlug).toBeUndefined();
  });

  it("reads bundleFlowsVersion from dependencies", async () => {
    await stage({
      flows: [{ name: "a.flow.ts", data: "// a" }],
      pkg: { dependencies: { "@qawolf/flows": "1.2.3" } },
    });
    const m = await buildManifest(baseArgs());
    expect(m.bundleFlowsVersion).toBe("1.2.3");
  });

  it("falls back to devDependencies for bundleFlowsVersion", async () => {
    await stage({
      flows: [{ name: "a.flow.ts", data: "// a" }],
      pkg: { devDependencies: { "@qawolf/flows": "2.0.0" } },
    });
    const m = await buildManifest(baseArgs());
    expect(m.bundleFlowsVersion).toBe("2.0.0");
  });

  it("returns bundleFlowsVersion as undefined when the bundle has no pin", async () => {
    await stage({
      flows: [{ name: "a.flow.ts", data: "// a" }],
      pkg: { name: "no-pin" },
    });
    const m = await buildManifest(baseArgs());
    expect(m.bundleFlowsVersion).toBeUndefined();
  });

  it("returns bundleFlowsVersion as undefined when package.json is missing", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "// a", "utf8");
    const m = await buildManifest(baseArgs());
    expect(m.bundleFlowsVersion).toBeUndefined();
  });

  it("returns bundleFlowsVersion as undefined when package.json is malformed JSON", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "// a", "utf8");
    await writeFile(join(workDir, "package.json"), "{not valid json", "utf8");
    const m = await buildManifest(baseArgs());
    expect(m.bundleFlowsVersion).toBeUndefined();
  });
});
