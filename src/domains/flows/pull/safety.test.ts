import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import type { Manifest } from "~/shell/manifest/types.js";
import {
  detectLocalModifications,
  promptOverwriteIfModified,
} from "./safety.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-safety-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

const baseManifest = (
  flows: { path: string; contentHash: string }[],
): Manifest => ({
  envId: "env-abc",
  envSlug: undefined,
  fetchedAt: "2026-05-10T12:00:00.000Z",
  envVarsFetchedAt: undefined,
  cliFlowsVersion: "0.1.0",
  qawolfCommitSha: undefined,
  qawolfCommittedAt: undefined,
  tagsFetchedAt: undefined,
  flows,
});

// sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
const helloHash =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

describe("detectLocalModifications", () => {
  it("returns [] when every file matches its manifest hash", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "hello", "utf8");
    const manifest = baseManifest([
      { path: "a.flow.ts", contentHash: helloHash },
    ]);
    expect(await detectLocalModifications(workDir, manifest)).toEqual([]);
  });

  it("flags a file whose hash differs as 'modified'", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "edited", "utf8");
    const manifest = baseManifest([
      { path: "a.flow.ts", contentHash: helloHash },
    ]);
    expect(await detectLocalModifications(workDir, manifest)).toEqual([
      { path: "a.flow.ts", reason: "modified" },
    ]);
  });

  it("flags a missing file as 'missing-from-disk'", async () => {
    const manifest = baseManifest([
      { path: "gone.flow.ts", contentHash: helloHash },
    ]);
    expect(await detectLocalModifications(workDir, manifest)).toEqual([
      { path: "gone.flow.ts", reason: "missing-from-disk" },
    ]);
  });

  it("ignores files on disk that are not in the manifest", async () => {
    await writeFile(join(workDir, "untracked.txt"), "stuff", "utf8");
    const manifest = baseManifest([]);
    expect(await detectLocalModifications(workDir, manifest)).toEqual([]);
  });

  it("rejects a manifest containing an absolute path entry", async () => {
    const manifest = baseManifest([
      { path: "/etc/passwd", contentHash: helloHash },
    ]);
    let caught: unknown;
    try {
      await detectLocalModifications(workDir, manifest);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/absolute|traversal/i);
  });

  it("rejects a manifest entry that escapes the env directory", async () => {
    const manifest = baseManifest([
      { path: "../escape.flow.ts", contentHash: helloHash },
    ]);
    let caught: unknown;
    try {
      await detectLocalModifications(workDir, manifest);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/escape|traversal/i);
  });
});

describe("promptOverwriteIfModified", () => {
  type Call = { message: string };

  function makeFakeConfirm(returns: boolean) {
    const calls: Call[] = [];
    const fn = async (message: string): Promise<boolean> => {
      calls.push({ message });
      return returns;
    };
    return { fn, calls };
  }

  function makeLog() {
    const lines: string[] = [];
    return { fn: (msg: string) => lines.push(msg), lines };
  }

  it("proceeds without prompt when there are no modifications", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "hello", "utf8");
    const manifest = baseManifest([
      { path: "a.flow.ts", contentHash: helloHash },
    ]);
    const confirm = makeFakeConfirm(false);
    const log = makeLog();

    const result = await promptOverwriteIfModified({
      envDir: workDir,
      manifest,
      yes: false,
      log: log.fn,
      confirm: confirm.fn,
    });

    expect(result).toBe("proceed");
    expect(confirm.calls).toEqual([]);
  });

  it("proceeds without prompt when only missing-from-disk entries exist", async () => {
    const manifest = baseManifest([
      { path: "gone.flow.ts", contentHash: helloHash },
    ]);
    const confirm = makeFakeConfirm(false);
    const log = makeLog();

    const result = await promptOverwriteIfModified({
      envDir: workDir,
      manifest,
      yes: false,
      log: log.fn,
      confirm: confirm.fn,
    });

    expect(result).toBe("proceed");
    expect(confirm.calls).toEqual([]);
  });

  it("proceeds without prompt and logs a notice when yes is true and mods exist", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "edited", "utf8");
    const manifest = baseManifest([
      { path: "a.flow.ts", contentHash: helloHash },
    ]);
    const confirm = makeFakeConfirm(true);
    const log = makeLog();

    const result = await promptOverwriteIfModified({
      envDir: workDir,
      manifest,
      yes: true,
      log: log.fn,
      confirm: confirm.fn,
    });

    expect(result).toBe("proceed");
    expect(confirm.calls).toEqual([]);
    expect(log.lines.join("\n")).toContain("a.flow.ts");
    expect(log.lines.join("\n")).toContain("overwriting");
  });

  it("prompts via confirm and proceeds when the user accepts", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "edited", "utf8");
    const manifest = baseManifest([
      { path: "a.flow.ts", contentHash: helloHash },
    ]);
    const confirm = makeFakeConfirm(true);
    const log = makeLog();

    const result = await promptOverwriteIfModified({
      envDir: workDir,
      manifest,
      yes: false,
      log: log.fn,
      confirm: confirm.fn,
    });

    expect(result).toBe("proceed");
    expect(confirm.calls).toHaveLength(1);
    expect(confirm.calls[0]?.message).toContain("a.flow.ts");
  });

  it("aborts when the user declines the prompt", async () => {
    await writeFile(join(workDir, "a.flow.ts"), "edited", "utf8");
    const manifest = baseManifest([
      { path: "a.flow.ts", contentHash: helloHash },
    ]);
    const confirm = makeFakeConfirm(false);
    const log = makeLog();

    const result = await promptOverwriteIfModified({
      envDir: workDir,
      manifest,
      yes: false,
      log: log.fn,
      confirm: confirm.fn,
    });

    expect(result).toBe("abort");
    expect(confirm.calls).toHaveLength(1);
  });
});
