import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prepareRunDir } from "./prepareRunDir.js";

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

async function makeDepsRoot(): Promise<string> {
  const depsRoot = await makeTmpDir();
  await mkdir(join(depsRoot, "node_modules"), { recursive: true });
  return depsRoot;
}

describe("stageFlowFiles — basename collision", () => {
  it("stages files with the same basename from different dirs into distinct subdir paths", async () => {
    const [runRoot, depsRoot, dirA, dirB] = await Promise.all([
      makeTmpDir(),
      makeDepsRoot(),
      makeTmpDir(),
      makeTmpDir(),
    ]);
    const flowA = join(dirA, "flow.ts");
    const flowB = join(dirB, "flow.ts");
    await Promise.all([
      writeFile(flowA, "// flow A"),
      writeFile(flowB, "// flow B"),
    ]);

    const result = await prepareRunDir({
      files: [flowA, flowB],
      projectDir: undefined,
      depsRoot,
      runRoot,
    });
    tmpDirs.push(result.runDir);

    expect(result.files).toHaveLength(2);
    const [pathA, pathB] = result.files;
    if (pathA === undefined || pathB === undefined) {
      throw new Error("expected 2 staged file paths");
    }
    expect(pathA).not.toBe(pathB);
    expect(await readFile(pathA, "utf-8")).toBe("// flow A");
    expect(await readFile(pathB, "utf-8")).toBe("// flow B");
  });
});
