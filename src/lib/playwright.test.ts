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

async function makeLocalPlaywright(
  root: string,
  bin: string | Record<string, string>,
): Promise<string> {
  const pkgDir = join(root, "node_modules", "playwright");
  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: "playwright", bin }),
  );
  const cliName =
    typeof bin === "string" ? bin : (bin["playwright"] ?? "cli.js");
  const cliPath = join(pkgDir, cliName);
  await writeFile(cliPath, "// playwright cli");
  return cliPath;
}

describe("resolvePlaywrightCli", () => {
  it("should resolve cli.js from local node_modules (bin as object)", async () => {
    const tmpDir = await makeTmpDir();
    const expected = await makeLocalPlaywright(tmpDir, {
      playwright: "cli.js",
    });
    expect(resolvePlaywrightCli(tmpDir, "")).toBe(expected);
  });

  it("should resolve cli.js from local node_modules (bin as string)", async () => {
    const tmpDir = await makeTmpDir();
    const expected = await makeLocalPlaywright(tmpDir, "cli.js");
    expect(resolvePlaywrightCli(tmpDir, "")).toBe(expected);
  });

  it("should resolve cli.js via PATH fallback when not installed locally", async () => {
    const emptyDir = await makeTmpDir();
    const globalDir = await makeTmpDir();
    const pkgDir = join(globalDir, "pkg", "playwright");
    const binDir = join(globalDir, "bin");
    await mkdir(pkgDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    const cliPath = join(pkgDir, "cli.js");
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "playwright", bin: { playwright: "cli.js" } }),
    );
    await writeFile(cliPath, "// playwright cli");
    // Symlink models npm global layout: bin/playwright → .../playwright/cli.js
    await symlink(cliPath, join(binDir, "playwright"));

    expect(resolvePlaywrightCli(emptyDir, binDir)).toBe(cliPath);
  });

  it("should resolve cli.js from a parent node_modules (monorepo hoisting)", async () => {
    const root = await makeTmpDir();
    // playwright is installed at the root, cwd is a nested package
    const cwd = join(root, "packages", "app");
    await mkdir(cwd, { recursive: true });
    const expected = await makeLocalPlaywright(root, { playwright: "cli.js" });
    expect(resolvePlaywrightCli(cwd, "")).toBe(expected);
  });

  it("should throw with install instructions when playwright is not found anywhere", async () => {
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
