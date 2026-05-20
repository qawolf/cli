import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { pathExists } from "~/shell/fs.js";
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
});
