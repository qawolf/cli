import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { pathExists } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { writeEnvFile } from "./envVars.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-envvars-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("writeEnvFile", () => {
  it("writes the file at <dir>/.env with mode 0600", async () => {
    await writeEnvFile(workDir, { TOKEN: "abc", URL: "https://example.com" });

    const body = await readFile(join(workDir, ".env"), "utf8");
    expect(body).toBe('TOKEN="abc"\nURL="https://example.com"\n');
    const stats = await stat(join(workDir, ".env"));
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("skips writing .env when no vars are present", async () => {
    await writeEnvFile(workDir, {});

    expect(await pathExists(join(workDir, ".env"))).toBe(false);
  });

  it("writes valid vars, drops invalid keys, and reports them", async () => {
    const { skippedKeys } = await writeEnvFile(workDir, {
      TOKEN: "abc",
      "BRIAN_2.0_AUTH_TOKEN": "secret",
    });

    expect(skippedKeys).toEqual(["BRIAN_2.0_AUTH_TOKEN"]);
    const body = await readFile(join(workDir, ".env"), "utf8");
    expect(body).toBe('TOKEN="abc"\n');
  });

  it("does not write an empty .env when every key is invalid", async () => {
    const { skippedKeys } = await writeEnvFile(workDir, {
      "BRIAN_2.0_AUTH_TOKEN": "secret",
    });

    expect(skippedKeys).toEqual(["BRIAN_2.0_AUTH_TOKEN"]);
    expect(await pathExists(join(workDir, ".env"))).toBe(false);
  });
});

describe("writeEnvFile (memory fs)", () => {
  it("writes env file via injected fs", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/env", { recursive: true });
    await writeEnvFile("/env", { KEY: "val" }, memFs);
    expect(await memFs.readFile("/env/.env")).toContain('KEY="val"');
  });

  it("does nothing when vars is empty", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/env", { recursive: true });
    await writeEnvFile("/env", {}, memFs);
    expect(await memFs.pathExists("/env/.env")).toBe(false);
  });
});
