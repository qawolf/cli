import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { pinnedPackages } from "./pinnedPackages.js";
import { ensureRuntimeEnv } from "./ensureRuntimeEnv.js";

const managedDir = "/data/runtime/abc123";

function seedFullEnv(fs: ReturnType<typeof makeMemoryFs>, dir: string): void {
  for (const { name, version } of pinnedPackages) {
    const pkgDir = join(dir, "node_modules", ...name.split("/"));
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ version }));
  }
  fs.writeFileSync(
    join(dir, "node_modules", "playwright", "cli.js"),
    "#!/usr/bin/env node",
  );
  const binDir = join(dir, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(join(binDir, "appium"), "#!/bin/sh");
}

function makeNoopInstall() {
  let called = false;
  const install = async (_targetDir: string): Promise<void> => {
    called = true;
  };
  return { install, wasCalled: () => called };
}

describe("ensureRuntimeEnv", () => {
  it("returns override source when overrideDir has all pinned deps", async () => {
    const fs = makeMemoryFs();
    const overrideDir = "/override/env";
    seedFullEnv(fs, overrideDir);
    const { install } = makeNoopInstall();

    const result = await ensureRuntimeEnv(
      { overrideDir, platform: "linux" },
      { fs, install, resolveManagedDir: () => managedDir },
    );

    expect(result).toEqual({
      depsRoot: overrideDir,
      source: "override",
      installed: false,
    });
  });

  it("throws when overrideDir is missing pinned dependencies", async () => {
    const fs = makeMemoryFs();
    const overrideDir = "/override/empty";
    const { install } = makeNoopInstall();

    let caughtError: unknown;
    try {
      await ensureRuntimeEnv(
        { overrideDir, platform: "linux" },
        { fs, install, resolveManagedDir: () => managedDir },
      );
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain(overrideDir);
  });

  it("names the failing package and shim in the rejection", async () => {
    const fs = makeMemoryFs();
    const overrideDir = "/override/stale";
    seedFullEnv(fs, overrideDir);
    const flowsPkg = join(overrideDir, "node_modules", "@qawolf", "flows");
    fs.writeFileSync(
      join(flowsPkg, "package.json"),
      JSON.stringify({ version: "0.0.0" }),
    );
    const { install } = makeNoopInstall();

    let caughtError: unknown;
    try {
      await ensureRuntimeEnv(
        { overrideDir, platform: "linux" },
        { fs, install, resolveManagedDir: () => managedDir },
      );
    } catch (e) {
      caughtError = e;
    }

    const pinned = pinnedPackages.find((p) => p.name === "@qawolf/flows");
    expect((caughtError as Error).message).toContain(
      `@qawolf/flows 0.0.0 (pinned ${pinned?.version})`,
    );
  });

  it("names a missing package as missing", async () => {
    const fs = makeMemoryFs();
    const overrideDir = "/override/partial";
    const { install } = makeNoopInstall();

    let caughtError: unknown;
    try {
      await ensureRuntimeEnv(
        { overrideDir, platform: "linux" },
        { fs, install, resolveManagedDir: () => managedDir },
      );
    } catch (e) {
      caughtError = e;
    }

    const message = (caughtError as Error).message;
    const pinned = pinnedPackages.find((p) => p.name === "appium");
    expect(message).toContain(`appium (missing, pinned ${pinned?.version})`);
    expect(message).toContain("node_modules/.bin/appium (missing)");
  });

  it("returns project source when projectDir has all pinned deps", async () => {
    const fs = makeMemoryFs();
    const projectDir = "/user/project";
    seedFullEnv(fs, projectDir);
    const { install, wasCalled } = makeNoopInstall();

    const result = await ensureRuntimeEnv(
      { projectDir, platform: "linux" },
      { fs, install, resolveManagedDir: () => managedDir },
    );

    expect(result).toEqual({
      depsRoot: projectDir,
      source: "project",
      installed: false,
    });
    expect(wasCalled()).toBe(false);
  });

  it("installs managed env and returns installed:true when no resolved dir exists", async () => {
    const fs = makeMemoryFs();
    let called = false;
    // Fake install materializes the managed dir so the post-install check passes.
    const install = async (targetDir: string): Promise<void> => {
      called = true;
      seedFullEnv(fs, targetDir);
    };

    const result = await ensureRuntimeEnv(
      { platform: "linux" },
      { fs, install, resolveManagedDir: () => managedDir },
    );

    expect(result).toEqual({
      depsRoot: managedDir,
      source: "managed",
      installed: true,
    });
    expect(called).toBe(true);
  });

  it("throws when install does not materialize the managed deps", async () => {
    const fs = makeMemoryFs();
    // Install resolves but leaves the managed dir incomplete.
    const { install } = makeNoopInstall();

    let caughtError: unknown;
    try {
      await ensureRuntimeEnv(
        { platform: "linux" },
        { fs, install, resolveManagedDir: () => managedDir },
      );
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain(
      "incomplete after install",
    );
    expect((caughtError as Error).message).toContain(managedDir);
  });

  it("returns installed:false when managed env is already complete", async () => {
    const fs = makeMemoryFs();
    seedFullEnv(fs, managedDir);
    const { install, wasCalled } = makeNoopInstall();

    const result = await ensureRuntimeEnv(
      { platform: "linux" },
      { fs, install, resolveManagedDir: () => managedDir },
    );

    expect(result).toEqual({
      depsRoot: managedDir,
      source: "managed",
      installed: false,
    });
    expect(wasCalled()).toBe(false);
  });
});
