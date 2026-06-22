import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { pinnedPackages } from "./pinnedPackages.js";
import { allPinnedResolved, readInstalledVersion } from "./resolvePinned.js";

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

function seedAllPackages(fs: ReturnType<typeof makeMemoryFs>): void {
  for (const { name, version } of pinnedPackages) {
    seedPackage(fs, name, version);
  }
  fs.mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(
    join(dir, "node_modules", ".bin", "playwright"),
    "#!/bin/sh",
  );
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

describe("allPinnedResolved", () => {
  it("returns true when all packages match and .bin/playwright exists", () => {
    const fs = makeMemoryFs();
    seedAllPackages(fs);

    expect(allPinnedResolved(dir, fs)).toBe(true);
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

    expect(allPinnedResolved(dir, fs)).toBe(false);
  });

  it("returns false when .bin/playwright shim is absent", () => {
    const fs = makeMemoryFs();
    for (const { name, version } of pinnedPackages) {
      seedPackage(fs, name, version);
    }
    // No .bin/playwright

    expect(allPinnedResolved(dir, fs)).toBe(false);
  });
});
