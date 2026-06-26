import { afterEach, describe, expect, it } from "bun:test";
import { join, resolve, sep } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { pinnedPackages } from "./pinnedPackages.js";
import {
  managedEnvBaseDir,
  managedEnvDir,
  managedEnvHash,
  runtimeChannel,
  runStagingRoot,
  scaffoldManagedEnv,
} from "./managedEnvDir.js";

describe("runtimeChannel", () => {
  const priorCompiled = process.env["QAWOLF_COMPILED"];

  afterEach(() => {
    if (priorCompiled === undefined) {
      delete process.env["QAWOLF_COMPILED"];
    } else {
      process.env["QAWOLF_COMPILED"] = priorCompiled;
    }
  });

  it('returns "binary" when QAWOLF_COMPILED is "true"', () => {
    process.env["QAWOLF_COMPILED"] = "true";
    expect(runtimeChannel()).toBe("binary");
  });

  it('returns "node" when QAWOLF_COMPILED is unset', () => {
    delete process.env["QAWOLF_COMPILED"];
    expect(runtimeChannel()).toBe("node");
  });

  it('returns "node" when QAWOLF_COMPILED is any other value', () => {
    process.env["QAWOLF_COMPILED"] = "false";
    expect(runtimeChannel()).toBe("node");
  });
});

describe("managedEnvHash", () => {
  const priorCompiled = process.env["QAWOLF_COMPILED"];

  afterEach(() => {
    if (priorCompiled === undefined) {
      delete process.env["QAWOLF_COMPILED"];
    } else {
      process.env["QAWOLF_COMPILED"] = priorCompiled;
    }
  });

  it("returns exactly 16 hex characters", () => {
    const hash = managedEnvHash();
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable within the node channel", () => {
    delete process.env["QAWOLF_COMPILED"];
    expect(managedEnvHash()).toBe(managedEnvHash());
  });

  it("is stable within the binary channel", () => {
    process.env["QAWOLF_COMPILED"] = "true";
    expect(managedEnvHash()).toBe(managedEnvHash());
  });

  it("differs between node and binary channels", () => {
    delete process.env["QAWOLF_COMPILED"];
    const nodeHash = managedEnvHash();

    process.env["QAWOLF_COMPILED"] = "true";
    const binaryHash = managedEnvHash();

    expect(nodeHash).not.toBe(binaryHash);
  });

  it("changes when a pinned package version changes", () => {
    delete process.env["QAWOLF_COMPILED"];
    const baseline = managedEnvHash();

    // Temporarily mutate the first pinned package version to simulate a version bump.
    const first = pinnedPackages[0];
    if (!first)
      throw new Error(
        "pinnedPackages is empty — cannot test version sensitivity",
      );
    const originalVersion = first.version;
    try {
      (first as { version: string }).version = originalVersion + "-modified";
      expect(managedEnvHash()).not.toBe(baseline);
    } finally {
      (first as { version: string }).version = originalVersion;
    }
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

describe("runStagingRoot", () => {
  const priorOverride = process.env["QAWOLF_RUNTIME_DIR"];

  afterEach(() => {
    if (priorOverride === undefined) {
      delete process.env["QAWOLF_RUNTIME_DIR"];
    } else {
      process.env["QAWOLF_RUNTIME_DIR"] = priorOverride;
    }
  });

  it("returns <managedEnvBaseDir>-runs and is not inside the managed base", () => {
    delete process.env["QAWOLF_RUNTIME_DIR"];
    const base = managedEnvBaseDir();
    const staging = runStagingRoot();
    expect(staging).toBe(`${base}-runs`);
    expect(staging.startsWith(base + sep)).toBe(false);
  });

  it("honors QAWOLF_RUNTIME_DIR and returns <resolved override>-runs", () => {
    process.env["QAWOLF_RUNTIME_DIR"] = "/custom/cache";
    const expected = `${resolve("/custom/cache")}-runs`;
    expect(runStagingRoot()).toBe(expected);
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
