import { describe, expect, it } from "bun:test";
import { join } from "node:path";

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
  it("ends with runtime/<hash>", () => {
    const hash = managedEnvHash();
    const result = managedEnvDir();
    expect(result).toContain(join("runtime", hash));
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
