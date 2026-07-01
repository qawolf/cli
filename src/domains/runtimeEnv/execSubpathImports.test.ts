import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { writeExecSubpathImports } from "./execSubpathImports.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeExecDir(): Promise<string> {
  const d = realpathSync(
    await mkdtemp(join(tmpdir(), "qawolf-subpath-imports-test-")),
  );
  tmpDirs.push(d);
  return d;
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

    expect(writeExecSubpathImports({ execDir, fs })).rejects.toThrow(
      "permission denied",
    );
  });
});
