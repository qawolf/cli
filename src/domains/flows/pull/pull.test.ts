import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { checkSafety, validateEnvId } from "./pull.js";

let workDir = "";

afterEach(() => {
  mock.restore();
});

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-pull-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("validateEnvId", () => {
  it("accepts UUID-style ids", () => {
    expect(validateEnvId("01234567-89ab-cdef-0123-456789abcdef")).toBe("ok");
  });

  it("accepts kebab-case slugs", () => {
    expect(validateEnvId("env-abc")).toBe("ok");
    expect(validateEnvId("f4844gq8r2lnuskkp88eonteoenv")).toBe("ok");
  });

  it("rejects strings with whitespace or punctuation", () => {
    const r = validateEnvId("Bad Env!");
    expect(r).not.toBe("ok");
    if (r !== "ok") expect(r.error).toMatch(/UUID|kebab/i);
  });
});

describe("checkSafety", () => {
  it("returns 'proceed' when no manifest exists at envDir", async () => {
    const envDir = join(workDir, "env");
    await mkdir(envDir, { recursive: true });

    let confirmCalled = false;
    const result = await checkSafety({
      envDir,
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

  it("returns 'proceed' when the manifest at envDir is malformed JSON", async () => {
    const envDir = join(workDir, "env");
    await mkdir(envDir, { recursive: true });
    await writeFile(join(envDir, ".manifest.json"), "{not json", "utf8");

    const result = await checkSafety({
      envDir,
      yes: false,
      log: () => {},
      confirm: async () => true,
    });

    expect(result).toBe("proceed");
  });
});
