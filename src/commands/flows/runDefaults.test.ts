import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { _buildPatternArgs, _loadEnvFile } from "./runDefaults.js";

describe("_buildPatternArgs", () => {
  it("wraps a pattern string in an array", () => {
    expect(_buildPatternArgs("tests/login.flow.ts")).toEqual([
      "tests/login.flow.ts",
    ]);
  });

  it("returns an empty array when pattern is undefined", () => {
    expect(_buildPatternArgs(undefined)).toEqual([]);
  });
});

describe("_loadEnvFile", () => {
  let dir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    dir = join(import.meta.dir, "__tmp_loadEnvFile__");
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    for (const key of Object.keys(savedEnv)) {
      delete savedEnv[key];
    }
  });

  function track(...keys: string[]): void {
    for (const key of keys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  }

  it("loads vars from .env into process.env", async () => {
    track("LOAD_A", "LOAD_B");
    await writeFile(join(dir, ".env"), 'LOAD_A="hello"\nLOAD_B="world"\n');
    await _loadEnvFile(dir);
    expect(process.env["LOAD_A"]).toBe("hello");
    expect(process.env["LOAD_B"]).toBe("world");
  });

  it("does not overwrite existing process.env values", async () => {
    track("LOAD_EXISTING");
    process.env["LOAD_EXISTING"] = "original";
    await writeFile(join(dir, ".env"), 'LOAD_EXISTING="from-file"\n');
    await _loadEnvFile(dir);
    expect(process.env["LOAD_EXISTING"]).toBe("original");
  });

  it("silently skips when .env does not exist", async () => {
    expect(_loadEnvFile(dir)).resolves.toBeUndefined();
  });

  it("throws when .env exists but contains an invalid line", async () => {
    await writeFile(join(dir, ".env"), "not-valid\n");
    expect(_loadEnvFile(dir)).rejects.toThrow(/Cannot parse/i);
  });
});
