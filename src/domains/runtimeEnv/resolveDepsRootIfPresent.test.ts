import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { managedEnvDir } from "./managedEnvDir.js";
import { pinnedPackages } from "./pinnedPackages.js";
import { resolveDepsRootIfPresent } from "./resolveDepsRootIfPresent.js";

function seedFullEnv(fs: ReturnType<typeof makeMemoryFs>, dir: string): void {
  for (const { name, version } of pinnedPackages) {
    const pkgDir = join(dir, "node_modules", ...name.split("/"));
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ version }));
  }
  const binDir = join(dir, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(join(binDir, "playwright"), "#!/bin/sh");
  fs.writeFileSync(join(binDir, "appium"), "#!/bin/sh");
}

describe("resolveDepsRootIfPresent", () => {
  it("returns overrideDir when override has all pinned deps", () => {
    const fs = makeMemoryFs();
    const overrideDir = "/override/env";
    seedFullEnv(fs, overrideDir);

    const result = resolveDepsRootIfPresent(
      { overrideDir, platform: "linux" },
      fs,
    );

    expect(result).toBe(overrideDir);
  });

  it("skips override and returns projectDir when override is absent but project is present", () => {
    const fs = makeMemoryFs();
    const projectDir = "/user/project";
    seedFullEnv(fs, projectDir);

    const result = resolveDepsRootIfPresent(
      { overrideDir: "/missing/override", projectDir, platform: "linux" },
      fs,
    );

    expect(result).toBe(projectDir);
  });

  it("returns projectDir when project has all pinned deps and no override is given", () => {
    const fs = makeMemoryFs();
    const projectDir = "/user/project";
    seedFullEnv(fs, projectDir);

    const result = resolveDepsRootIfPresent(
      { projectDir, platform: "linux" },
      fs,
    );

    expect(result).toBe(projectDir);
  });

  it("returns managed dir when only managed env is installed", () => {
    const fs = makeMemoryFs();
    const managed = managedEnvDir();
    seedFullEnv(fs, managed);

    const result = resolveDepsRootIfPresent({ platform: "linux" }, fs);

    expect(result).toBe(managed);
  });

  it("returns undefined when no directory has all pinned deps installed", () => {
    const fs = makeMemoryFs();

    const result = resolveDepsRootIfPresent(
      { projectDir: "/missing/project", platform: "linux" },
      fs,
    );

    expect(result).toBeUndefined();
  });

  it("returns undefined when called with no args and managed env is absent", () => {
    const fs = makeMemoryFs();

    const result = resolveDepsRootIfPresent({ platform: "linux" }, fs);

    expect(result).toBeUndefined();
  });
});
