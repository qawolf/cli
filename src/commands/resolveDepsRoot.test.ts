import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { pinnedPackages } from "~/domains/runtimeEnv/pinnedPackages.js";
import { managedEnvDir } from "~/domains/runtimeEnv/managedEnvDir.js";

import { resolveDepsRoot } from "./resolveDepsRoot.js";

type MemFs = ReturnType<typeof makeMemoryFs>;

// Materializes every pinned package at its exact version plus the .bin/playwright
// shim so allPinnedResolved(dir) returns true for `dir`.
function seedFullEnv(fs: MemFs, dir: string): void {
  for (const { name, version } of pinnedPackages) {
    const pkgDir = join(dir, "node_modules", ...name.split("/"));
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ version }));
  }
  const binDir = join(dir, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(join(binDir, "playwright"), "#!/bin/sh");
}

function seedPackageJson(fs: MemFs, dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "pkg" }));
}

describe("resolveDepsRoot", () => {
  it("returns the project dir when a single package resolves its pinned deps", async () => {
    const fs = makeMemoryFs();
    const projectDir = "/user/project";
    seedFullEnv(fs, projectDir);
    seedPackageJson(fs, projectDir);

    const result = await resolveDepsRoot({
      files: [join(projectDir, "flows", "login.flow.ts")],
      fs,
      platform: "linux",
    });

    expect(result).toEqual({
      depsRoot: projectDir,
      source: "project",
      installed: false,
    });
  });

  it("falls back to the managed dir when flow files span multiple packages", async () => {
    const fs = makeMemoryFs();
    seedPackageJson(fs, "/repo/a");
    seedPackageJson(fs, "/repo/b");
    const managed = managedEnvDir();
    seedFullEnv(fs, managed);

    const result = await resolveDepsRoot({
      files: ["/repo/a/x.flow.ts", "/repo/b/y.flow.ts"],
      fs,
      platform: "linux",
    });

    expect(result).toEqual({
      depsRoot: managed,
      source: "managed",
      installed: false,
    });
  });

  it("forwards overrideDir to ensureRuntimeEnv", async () => {
    const fs = makeMemoryFs();
    const overrideDir = "/custom/deps";
    seedFullEnv(fs, overrideDir);

    const result = await resolveDepsRoot({
      files: ["/anywhere/x.flow.ts"],
      overrideDir,
      fs,
      platform: "linux",
    });

    expect(result).toEqual({
      depsRoot: overrideDir,
      source: "override",
      installed: false,
    });
  });
});
