import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  manifestFilename,
  type Manifest,
  hashFile,
  readManifest,
  writeManifest,
} from "./manifest.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-manifest-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

const sample: Manifest = {
  envId: "env-abc",
  envSlug: "staging",
  fetchedAt: "2026-05-10T12:00:00.000Z",
  envVarsFetchedAt: "2026-05-10T12:30:00.000Z",
  cliFlowsVersion: "0.1.0",
  bundleFlowsVersion: "0.1.0",
  files: [{ path: "checkout.flow.ts", sha256: "deadbeef" }],
};

describe("readManifest", () => {
  it("returns 'missing' when no manifest file exists", async () => {
    expect(await readManifest(workDir)).toBe("missing");
  });

  it("returns the parsed manifest after writeManifest", async () => {
    await writeManifest(workDir, sample);
    expect(await readManifest(workDir)).toEqual(sample);
  });

  it("returns 'malformed' on invalid JSON", async () => {
    await writeFile(join(workDir, manifestFilename), "{not json", "utf8");
    expect(await readManifest(workDir)).toBe("malformed");
  });

  it("returns 'malformed' when JSON shape does not match", async () => {
    await writeFile(
      join(workDir, manifestFilename),
      JSON.stringify({ envId: 7 }),
      "utf8",
    );
    expect(await readManifest(workDir)).toBe("malformed");
  });
});

describe("writeManifest", () => {
  it("writes pretty-printed JSON to .manifest.json", async () => {
    await writeManifest(workDir, sample);
    const raw = await Bun.file(join(workDir, manifestFilename)).text();
    expect(raw).toContain("\n");
    expect(JSON.parse(raw)).toEqual(sample);
  });

  it("preserves envSlug as undefined when absent", async () => {
    const m: Manifest = { ...sample, envSlug: undefined };
    await writeManifest(workDir, m);
    const round = await readManifest(workDir);
    expect(round).toEqual(m);
  });
});

describe("hashFile", () => {
  it("returns a stable hex sha256 of file bytes", async () => {
    const f = join(workDir, "a.txt");
    await writeFile(f, "hello world", "utf8");
    // sha256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    expect(await hashFile(f)).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("hashes large files via streaming (no in-memory buffer)", async () => {
    const f = join(workDir, "big.bin");
    await writeFile(f, Buffer.alloc(1024 * 1024, 0x61));
    const a = await hashFile(f);
    const b = await hashFile(f);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
