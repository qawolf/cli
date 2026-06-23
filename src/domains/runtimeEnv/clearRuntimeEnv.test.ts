import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { clearRuntimeEnv } from "./clearRuntimeEnv.js";
import { managedEnvBaseDir } from "./managedEnvDir.js";

describe("clearRuntimeEnv", () => {
  const originalRuntimeDir = process.env["QAWOLF_RUNTIME_DIR"];

  afterEach(() => {
    if (originalRuntimeDir === undefined) {
      delete process.env["QAWOLF_RUNTIME_DIR"];
    } else {
      process.env["QAWOLF_RUNTIME_DIR"] = originalRuntimeDir;
    }
  });

  it("removes the base dir when present and returns existed: true", async () => {
    const fs = makeMemoryFs();
    const baseDir = managedEnvBaseDir();
    const hashDir = `${baseDir}/abc123def456`;
    await fs.mkdir(hashDir, { recursive: true });
    await fs.writeFile(`${hashDir}/package.json`, '{"name":"qawolf-runtime"}');

    const result = await clearRuntimeEnv(fs);

    expect(result).toEqual({ dir: baseDir, existed: true });
    expect(await fs.pathExists(baseDir)).toBe(false);
  });

  it("returns existed: false and does not throw when base dir is absent", async () => {
    const fs = makeMemoryFs();

    const result = await clearRuntimeEnv(fs);

    expect(result.existed).toBe(false);
    expect(result.dir).toBe(managedEnvBaseDir());
  });

  it("honors QAWOLF_RUNTIME_DIR and returns its resolved path", async () => {
    const override = "/tmp/qawolf-rt-test";
    process.env["QAWOLF_RUNTIME_DIR"] = override;

    const fs = makeMemoryFs();
    await fs.mkdir(override, { recursive: true });

    const result = await clearRuntimeEnv(fs);

    expect(result.dir).toBe(resolve(override));
    expect(result.existed).toBe(true);
  });
});
