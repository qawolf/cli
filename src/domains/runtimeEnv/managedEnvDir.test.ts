import { afterEach, describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { pinnedPackages } from "./pinnedPackages.js";
import {
  managedEnvDir,
  managedEnvHash,
  scaffoldManagedEnv,
} from "./managedEnvDir.js";

describe("managedEnvHash", () => {
  it("returns exactly 16 hex characters", () => {
    const hash = managedEnvHash();
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable across multiple calls", () => {
    expect(managedEnvHash()).toBe(managedEnvHash());
  });
});

describe("managedEnvDir", () => {
  const priorOverride = process.env["QAWOLF_RUNTIME_DIR"];

  afterEach(() => {
    if (priorOverride === undefined) {
      delete process.env["QAWOLF_RUNTIME_DIR"];
    } else {
      process.env["QAWOLF_RUNTIME_DIR"] = priorOverride;
    }
  });

  it("ends with runtime/<hash> when QAWOLF_RUNTIME_DIR is unset", () => {
    delete process.env["QAWOLF_RUNTIME_DIR"];
    const hash = managedEnvHash();
    expect(managedEnvDir()).toContain(join("runtime", hash));
  });

  it("uses QAWOLF_RUNTIME_DIR as the base, dropping the runtime/ segment", () => {
    process.env["QAWOLF_RUNTIME_DIR"] = "/custom/cache";
    const hash = managedEnvHash();
    expect(managedEnvDir()).toBe(join(resolve("/custom/cache"), hash));
    expect(managedEnvDir()).not.toContain(join("runtime", hash));
  });

  it("resolves a relative QAWOLF_RUNTIME_DIR to an absolute path", () => {
    process.env["QAWOLF_RUNTIME_DIR"] = "./rt-cache";
    const hash = managedEnvHash();
    expect(managedEnvDir()).toBe(join(resolve("./rt-cache"), hash));
  });

  it("falls back to the default base when QAWOLF_RUNTIME_DIR is whitespace", () => {
    process.env["QAWOLF_RUNTIME_DIR"] = "   ";
    const hash = managedEnvHash();
    expect(managedEnvDir()).toContain(join("runtime", hash));
  });
});

describe("scaffoldManagedEnv", () => {
  it("creates the directory and writes a package.json with all pinned deps", async () => {
    const fs = makeMemoryFs();
    const dir = "/test/managed/env";

    await scaffoldManagedEnv(dir, fs);

    const raw = fs.readFileSync(join(dir, "package.json"));
    const pkg = JSON.parse(raw) as {
      name: string;
      private: boolean;
      dependencies: Record<string, string>;
    };

    expect(pkg.name).toBe("qawolf-runtime");
    expect(pkg.private).toBe(true);
    expect(Object.keys(pkg.dependencies)).toHaveLength(pinnedPackages.length);
    for (const { name, version } of pinnedPackages) {
      expect(pkg.dependencies[name]).toBe(version);
    }
  });

  it("writes an .npmrc pinning the @qawolf scope to public npm", async () => {
    const fs = makeMemoryFs();
    const dir = "/test/managed/env";

    await scaffoldManagedEnv(dir, fs);

    const npmrc = fs.readFileSync(join(dir, ".npmrc"));
    expect(npmrc).toContain("@qawolf:registry=https://registry.npmjs.org/");
  });
});
