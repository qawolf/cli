import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { pinnedPackages } from "./pinnedPackages.js";
import {
  allPinnedResolved,
  pinnedResolutionFailures,
  readInstalledVersion,
} from "./resolvePinned.js";

const dir = "/project";

function seedPackage(
  fs: ReturnType<typeof makeMemoryFs>,
  pkgName: string,
  version: string,
): void {
  const pkgDir = join(dir, "node_modules", ...pkgName.split("/"));
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ version }));
}

function seedPlaywrightCliJs(fs: ReturnType<typeof makeMemoryFs>): void {
  const pkgDir = join(dir, "node_modules", "playwright");
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(join(pkgDir, "cli.js"), "#!/usr/bin/env node");
}

function seedShim(
  fs: ReturnType<typeof makeMemoryFs>,
  name: string,
  contents: string,
): void {
  fs.mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(join(dir, "node_modules", ".bin", name), contents);
}

function seedAllPackages(fs: ReturnType<typeof makeMemoryFs>): void {
  for (const { name, version } of pinnedPackages) {
    seedPackage(fs, name, version);
  }
  seedPlaywrightCliJs(fs);
  seedShim(fs, "appium", "#!/bin/sh");
}

describe("readInstalledVersion", () => {
  it("returns the version when package.json is present", () => {
    const fs = makeMemoryFs();
    seedPackage(fs, "@qawolf/flows", "1.2.3");

    expect(readInstalledVersion(dir, "@qawolf/flows", fs)).toBe("1.2.3");
  });

  it("returns undefined when the package directory is missing", () => {
    const fs = makeMemoryFs();

    expect(readInstalledVersion(dir, "@qawolf/flows", fs)).toBeUndefined();
  });

  it("returns undefined when package.json has no version field", () => {
    const fs = makeMemoryFs();
    seedPackage(fs, "playwright", "");
    // Overwrite with JSON that has no version field
    const pkgDir = join(dir, "node_modules", "playwright");
    fs.writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "playwright" }),
    );

    expect(readInstalledVersion(dir, "playwright", fs)).toBeUndefined();
  });

  it("returns undefined when package.json contains malformed JSON", () => {
    const fs = makeMemoryFs();
    fs.mkdirSync(join(dir, "node_modules", "playwright"), { recursive: true });
    fs.writeFileSync(
      join(dir, "node_modules", "playwright", "package.json"),
      "not-json",
    );

    expect(readInstalledVersion(dir, "playwright", fs)).toBeUndefined();
  });
});

describe("pinnedResolutionFailures", () => {
  it("reports the installed version alongside the pinned one", () => {
    const fs = makeMemoryFs();
    seedAllPackages(fs);
    seedPackage(fs, "@qawolf/flows", "0.0.0");

    const pinned = pinnedPackages.find((p) => p.name === "@qawolf/flows");

    expect(pinnedResolutionFailures(dir, fs, "linux")).toEqual([
      {
        kind: "package",
        name: "@qawolf/flows",
        pinned: pinned?.version ?? "",
        installed: "0.0.0",
      },
    ]);
  });

  it("reports an absent package with no installed version", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      if (name !== "appium") {
        seedPackage(fs, name, version);
      }
    }
    seedPlaywrightCliJs(fs);
    seedShim(fs, "appium", "#!/bin/sh");

    const pinned = pinnedPackages.find((p) => p.name === "appium");

    expect(pinnedResolutionFailures(dir, fs, "linux")).toEqual([
      {
        kind: "package",
        name: "appium",
        pinned: pinned?.version ?? "",
        installed: undefined,
      },
    ]);
  });

  it("returns no failures when every package matches", () => {
    const fs = makeMemoryFs();
    seedAllPackages(fs);

    expect(pinnedResolutionFailures(dir, fs, "linux")).toEqual([]);
  });

  // The state WIZ-11284 made rejectable: every package matches, but the
  // directory has no runnable appium.
  it("reports a missing appium shim even when every package matches", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedPlaywrightCliJs(fs);

    expect(pinnedResolutionFailures(dir, fs, "linux")).toEqual([
      { kind: "shim", name: "appium", display: "node_modules/.bin/appium" },
    ]);
  });

  it("reports a missing playwright cli.js even when every package matches", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedShim(fs, "appium", "#!/bin/sh");

    expect(pinnedResolutionFailures(dir, fs, "linux")).toEqual([
      {
        kind: "shim",
        name: "playwright",
        display: "node_modules/playwright/cli.js",
      },
    ]);
  });
});

describe("allPinnedResolved", () => {
  it("returns true when all packages match, cli.js and the appium shim exist", () => {
    const fs = makeMemoryFs();
    seedAllPackages(fs);

    expect(allPinnedResolved(dir, fs, "linux")).toBe(true);
  });

  it("returns false when one package version does not match", () => {
    const fs = makeMemoryFs();
    seedAllPackages(fs);
    // Overwrite one package with wrong version
    const pkgDir = join(dir, "node_modules", "@qawolf", "flows");
    fs.writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ version: "0.0.0" }),
    );

    expect(allPinnedResolved(dir, fs, "linux")).toBe(false);
  });

  it("returns false when playwright's cli.js is absent", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedShim(fs, "appium", "#!/bin/sh");

    expect(allPinnedResolved(dir, fs, "linux")).toBe(false);
  });

  it("returns false when the .bin/appium shim is absent", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedPlaywrightCliJs(fs);
    // No .bin/appium — the state that used to leave a resolved root with no
    // runnable Appium, so `flows run` failed after install reported success.

    expect(allPinnedResolved(dir, fs, "linux")).toBe(false);
  });

  // playwright's cli.js is a plain script run through the CLI's own runtime,
  // so it is platform-independent; only appium still needs Windows shims.
  it.each([
    ["appium.cmd", "@echo off"],
    ["appium.exe", "MZ"],
  ] as const)("returns true on win32 with cli.js and only %s", (shim, body) => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedPlaywrightCliJs(fs);
    seedShim(fs, shim, body);

    expect(allPinnedResolved(dir, fs, "win32")).toBe(true);
  });

  // CreateProcess reports ENOENT for the extension-less shim, measured on
  // windows-latest in WIZ-11286.
  it("returns false on win32 when only the extension-less appium shim exists", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedPlaywrightCliJs(fs);
    seedShim(fs, "appium", "#!/bin/sh");

    expect(allPinnedResolved(dir, fs, "win32")).toBe(false);
  });

  it("ignores an appium .cmd shim off win32", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    seedPlaywrightCliJs(fs);
    seedShim(fs, "appium.cmd", "@echo off");

    expect(allPinnedResolved(dir, fs, "linux")).toBe(false);
  });
});
