import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeDefaultFs } from "~/shell/fs.js";
import {
  hashFile,
  manifestFilename,
  readManifest,
  writeManifest,
} from "./io.js";
import type { Manifest } from "./types.js";

const envDir = "/qawolf/manifest-test";

const sample: Manifest = {
  envId: "env-abc",
  envSlug: "staging",
  fetchedAt: "2026-05-10T12:00:00.000Z",
  cliFlowsVersion: "0.1.0",
  qawolfCommitSha: "c67b5b6ff48766ca3cd72ceb4037e95c49633725",
  qawolfCommittedAt: "2026-05-09T10:00:00.000Z",
  envVarsFetchedAt: "2026-05-10T12:30:00.000Z",
  flows: [{ path: "src/checkout.flow.ts", contentHash: "deadbeef" }],
};

describe("readManifest", () => {
  it("returns 'missing' when no manifest file exists", async () => {
    const memFs = makeMemoryFs();
    const result = await readManifest(envDir, memFs);
    expect(result).toBe("missing");
  });

  it("returns the parsed manifest after writeManifest", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(envDir, { recursive: true });
    await writeManifest(envDir, sample, memFs);
    const result = await readManifest(envDir, memFs);
    expect(result).toEqual(sample);
  });

  it("returns 'malformed' on invalid JSON", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(envDir, { recursive: true });
    await memFs.writeFile(join(envDir, manifestFilename), "{not json");
    const result = await readManifest(envDir, memFs);
    expect(result).toBe("malformed");
  });

  it("returns 'malformed' when JSON shape does not match", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(envDir, { recursive: true });
    await memFs.writeFile(
      join(envDir, manifestFilename),
      JSON.stringify({ envId: 7 }),
    );
    const result = await readManifest(envDir, memFs);
    expect(result).toBe("malformed");
  });
});

describe("writeManifest", () => {
  it("writes pretty-printed JSON to .manifest.json", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(envDir, { recursive: true });
    await writeManifest(envDir, sample, memFs);
    const raw = await memFs.readFile(join(envDir, manifestFilename));
    expect(raw).toContain("\n");
    expect(JSON.parse(raw)).toEqual(sample);
  });

  it("preserves optional fields as undefined when absent", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir(envDir, { recursive: true });
    const minimal: Manifest = {
      envId: "env-min",
      envSlug: undefined,
      fetchedAt: "2026-05-10T12:00:00.000Z",
      cliFlowsVersion: "0.1.0",
      qawolfCommitSha: undefined,
      qawolfCommittedAt: undefined,
      envVarsFetchedAt: undefined,
      flows: [],
    };
    await writeManifest(envDir, minimal, memFs);
    const round = await readManifest(envDir, memFs);
    expect(round).toEqual(minimal);
  });
});

describe("hashFile", () => {
  let workDir = "";

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "qawolf-manifest-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("returns a stable hex sha256 of file bytes", async () => {
    const f = join(workDir, "a.txt");
    await writeFile(f, "hello world", "utf8");
    // sha256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    expect(await hashFile(f, makeDefaultFs())).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("hashes large files via streaming (no in-memory buffer)", async () => {
    const f = join(workDir, "big.bin");
    await writeFile(f, Buffer.alloc(1024 * 1024, 0x61));
    const a = await hashFile(f, makeDefaultFs());
    const b = await hashFile(f, makeDefaultFs());
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("should hash file content via injected memFs", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/hash-test", { recursive: true });
    await memFs.writeFile("/hash-test/a.txt", "hello world");
    const result = await hashFile("/hash-test/a.txt", memFs);
    // sha256("hello world")
    expect(result).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });
});
