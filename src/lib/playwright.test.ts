import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvePlaywrightCli } from "./playwright.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  // realpathSync normalises /var → /private/var on macOS so path comparisons
  // against resolved paths (e.g. from createRequire.resolve) stay consistent.
  const d = realpathSync(
    await mkdtemp(join(tmpdir(), "qawolf-playwright-test-")),
  );
  tmpDirs.push(d);
  return d;
}

// Creates a fake playwright package in root/node_modules and the corresponding
// .bin/playwright wrapper. Returns the bin wrapper path, which is what
// resolvePlaywrightCli is expected to return for local installs.
async function makeLocalPlaywright(root: string): Promise<string> {
  const pkgDir = join(root, "node_modules", "playwright");
  const binDir = join(root, "node_modules", ".bin");
  await mkdir(pkgDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: "playwright", bin: { playwright: "cli.js" } }),
  );
  await writeFile(join(pkgDir, "cli.js"), "// playwright cli");
  const binWrapper = join(binDir, "playwright");
  await writeFile(binWrapper, "#!/usr/bin/env node\nrequire('./cli.js')");
  return binWrapper;
}

describe("resolvePlaywrightCli", () => {
  it("returns the .bin/playwright wrapper from local node_modules", async () => {
    const tmpDir = await makeTmpDir();
    const expected = await makeLocalPlaywright(tmpDir);
    expect(resolvePlaywrightCli(tmpDir, "")).toBe(expected);
  });

  it("returns the playwright binary from PATH when not installed locally", async () => {
    const emptyDir = await makeTmpDir();
    const globalDir = await makeTmpDir();
    const binDir = join(globalDir, "bin");
    const pkgDir = join(globalDir, "pkg", "playwright");
    await mkdir(binDir, { recursive: true });
    await mkdir(pkgDir, { recursive: true });
    const cliPath = join(pkgDir, "cli.js");
    await writeFile(cliPath, "// playwright cli");
    const binPath = join(binDir, "playwright");
    // Symlink models npm global layout: bin/playwright → .../playwright/cli.js
    await symlink(cliPath, binPath);

    expect(resolvePlaywrightCli(emptyDir, binDir)).toBe(binPath);
  });

  it("resolves via parent node_modules in a monorepo (hoisted install)", async () => {
    const root = await makeTmpDir();
    const cwd = join(root, "packages", "app");
    await mkdir(cwd, { recursive: true });
    const expected = await makeLocalPlaywright(root);
    expect(resolvePlaywrightCli(cwd, "")).toBe(expected);
  });

  it("throws with install instructions when playwright is not found anywhere", async () => {
    const emptyDir = await makeTmpDir();
    let caughtError: unknown;
    try {
      resolvePlaywrightCli(emptyDir, "");
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain(
      "Could not find Playwright",
    );
  });
});
