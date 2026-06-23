import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { pathExists } from "~/shell/fs.js";

import { stageFlows } from "./stageFlows.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  const d = realpathSync(await mkdtemp(join(tmpdir(), "qawolf-stage-test-")));
  tmpDirs.push(d);
  return d;
}

describe("stageFlows", () => {
  it("passes through unchanged when there is no project dir", async () => {
    const files = ["/some/a.flow.ts", "/some/b.flow.ts"];

    const result = await stageFlows({
      files,
      projectDir: undefined,
      cwd: "/cwd",
    });

    expect(result).toEqual({ files, bundleRoot: undefined });
  });

  it("uses the project in place when it already lives under .qawolf", async () => {
    const cwd = await makeTmpDir();
    const projectDir = join(cwd, ".qawolf", "my-env");
    const files = [join(projectDir, "login.flow.ts")];

    const result = await stageFlows({ files, projectDir, cwd });

    expect(result).toEqual({ files, bundleRoot: projectDir });
    expect(await pathExists(join(cwd, ".qawolf", ".local"))).toBe(false);
  });

  it("stages a raw in-place project and remaps flow paths", async () => {
    const projectDir = await makeTmpDir();
    const cwd = await makeTmpDir();
    await writeFile(join(projectDir, "package.json"), "{}");
    await mkdir(join(projectDir, "flows"), { recursive: true });
    await writeFile(join(projectDir, "flows", "a.flow.ts"), "export {};");
    await mkdir(join(projectDir, "node_modules", "dep"), { recursive: true });
    await writeFile(join(projectDir, "node_modules", "dep", "i.js"), "");
    await mkdir(join(projectDir, ".git"), { recursive: true });
    await writeFile(join(projectDir, ".git", "HEAD"), "ref");
    await mkdir(join(projectDir, ".qawolf"), { recursive: true });
    await writeFile(join(projectDir, ".qawolf", "x"), "");

    const files = [join(projectDir, "flows", "a.flow.ts")];
    const result = await stageFlows({ files, projectDir, cwd });

    const stagedDir = result.bundleRoot;
    expect(stagedDir).toBeDefined();
    expect(stagedDir?.startsWith(join(cwd, ".qawolf", ".local"))).toBe(true);

    // Copied source is present.
    expect(await pathExists(join(stagedDir as string, "package.json"))).toBe(
      true,
    );
    expect(
      await pathExists(join(stagedDir as string, "flows", "a.flow.ts")),
    ).toBe(true);

    // Excluded dirs are absent.
    expect(await pathExists(join(stagedDir as string, "node_modules"))).toBe(
      false,
    );
    expect(await pathExists(join(stagedDir as string, ".git"))).toBe(false);
    expect(await pathExists(join(stagedDir as string, ".qawolf"))).toBe(false);

    // Flow paths are remapped onto the staged copy.
    expect(result.files).toEqual([
      join(stagedDir as string, "flows", "a.flow.ts"),
    ]);
  });

  it("stages when cwd is the project dir (staged dir nested under source)", async () => {
    // The real flows-run case: you run from your project, so the staged dir
    // (<cwd>/.qawolf/.local/<hash>) lives INSIDE projectDir. A single recursive
    // copy would reject with EINVAL here; entry-by-entry copy must succeed.
    const projectDir = await makeTmpDir();
    await writeFile(join(projectDir, "package.json"), "{}");
    await mkdir(join(projectDir, "src"), { recursive: true });
    await writeFile(join(projectDir, "src", "a.flow.ts"), "export {};");

    const files = [join(projectDir, "src", "a.flow.ts")];
    const result = await stageFlows({ files, projectDir, cwd: projectDir });

    const stagedDir = result.bundleRoot as string;
    expect(stagedDir.startsWith(join(projectDir, ".qawolf", ".local"))).toBe(
      true,
    );
    expect(await pathExists(join(stagedDir, "src", "a.flow.ts"))).toBe(true);
    // The staging dir itself must not be recursively copied into itself.
    expect(await pathExists(join(stagedDir, ".qawolf"))).toBe(false);
    expect(result.files).toEqual([join(stagedDir, "src", "a.flow.ts")]);
  });

  it("refreshes the staged dir on re-run so edits are picked up", async () => {
    const projectDir = await makeTmpDir();
    const cwd = await makeTmpDir();
    await writeFile(join(projectDir, "package.json"), "{}");
    await writeFile(join(projectDir, "a.flow.ts"), "v1");
    const files = [join(projectDir, "a.flow.ts")];

    const first = await stageFlows({ files, projectDir, cwd });
    await writeFile(join(projectDir, "a.flow.ts"), "v2");
    const second = await stageFlows({ files, projectDir, cwd });

    expect(second.bundleRoot).toBe(first.bundleRoot as string);
    const staged = await stat(join(second.bundleRoot as string, "a.flow.ts"));
    expect(staged.isFile()).toBe(true);
    expect(
      await readFile(join(second.bundleRoot as string, "a.flow.ts"), "utf8"),
    ).toBe("v2");
  });

  it("returns a cleanup that removes the staged dir; passthrough has none", async () => {
    const projectDir = await makeTmpDir();
    const cwd = await makeTmpDir();
    await writeFile(join(projectDir, "package.json"), "{}");
    const files = [join(projectDir, "a.flow.ts")];

    const result = await stageFlows({ files, projectDir, cwd });
    expect(await pathExists(result.bundleRoot as string)).toBe(true);
    await result.cleanup?.();
    expect(await pathExists(result.bundleRoot as string)).toBe(false);

    // No staged copy was created for the in-place .qawolf case → no cleanup.
    const qawolfProject = join(cwd, ".qawolf", "env");
    const passthrough = await stageFlows({
      files: [join(qawolfProject, "x.flow.ts")],
      projectDir: qawolfProject,
      cwd,
    });
    expect(passthrough.cleanup).toBeUndefined();
  });
});
