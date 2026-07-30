import { afterEach, describe, expect, it } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { writeExecSubpathImports } from "./execSubpathImports.js";
import { makeTmpDirTracker } from "./runDirFixtures.testUtils.js";

const tracker = makeTmpDirTracker("qawolf-subpath-imports-test-");

afterEach(() => tracker.cleanup());

function makeExecDir(): Promise<string> {
  return tracker.makeTmpDir();
}

type PackageJson = {
  name?: string;
  type?: string;
  dependencies?: Record<string, string>;
  imports?: Record<string, unknown>;
};

async function readPackageJson(execDir: string): Promise<PackageJson> {
  const content = await readFile(join(execDir, "package.json"), "utf-8");
  return JSON.parse(content) as PackageJson;
}

describe("writeExecSubpathImports", () => {
  it("adds the #playwright alias while preserving existing fields", async () => {
    const execDir = await makeExecDir();
    await writeFile(
      join(execDir, "package.json"),
      JSON.stringify({
        name: "@qawolf/demo",
        type: "module",
        dependencies: { dotenv: "^16.4.5" },
      }),
    );

    await writeExecSubpathImports({ execDir, fs: makeDefaultFs() });

    const pkg = await readPackageJson(execDir);
    expect(pkg.imports).toEqual({ "#playwright": "playwright" });
    expect(pkg.name).toBe("@qawolf/demo");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies).toEqual({ dotenv: "^16.4.5" });
  });

  it("overrides a conflicting #playwright entry but keeps other imports", async () => {
    const execDir = await makeExecDir();
    await writeFile(
      join(execDir, "package.json"),
      JSON.stringify({
        imports: { "#playwright": "patchright", "#utils": "./src/utils.js" },
      }),
    );

    await writeExecSubpathImports({ execDir, fs: makeDefaultFs() });

    const pkg = await readPackageJson(execDir);
    expect(pkg.imports).toEqual({
      "#utils": "./src/utils.js",
      "#playwright": "playwright",
    });
  });

  it("creates package.json with imports when none exists", async () => {
    const execDir = await makeExecDir();

    await writeExecSubpathImports({ execDir, fs: makeDefaultFs() });

    const pkg = await readPackageJson(execDir);
    expect(pkg.imports).toEqual({ "#playwright": "playwright" });
  });

  it("recovers from an invalid package.json by writing a fresh imports map", async () => {
    const execDir = await makeExecDir();
    await writeFile(join(execDir, "package.json"), "{ not valid json");

    await writeExecSubpathImports({ execDir, fs: makeDefaultFs() });

    const pkg = await readPackageJson(execDir);
    expect(pkg.imports).toEqual({ "#playwright": "playwright" });
  });

  it("propagates a non-ENOENT read error instead of clobbering package.json", async () => {
    const execDir = await makeExecDir();
    const ioError = Object.assign(Error("EACCES: permission denied"), {
      code: "EACCES",
    });
    const fs: Fs = {
      ...makeDefaultFs(),
      readFile: () => Promise.reject(ioError),
    };

    let caught: unknown;
    try {
      await writeExecSubpathImports({ execDir, fs });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("permission denied");
  });
});
