import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeTmpDirTracker } from "./runDirFixtures.testUtils.js";
import { prepareRunDir } from "./prepareRunDir.js";

const tracker = makeTmpDirTracker("qawolf-stage-test-");

afterEach(() => tracker.cleanup());

async function makeDepsRoot(): Promise<string> {
  const depsRoot = await tracker.makeTmpDir();
  await mkdir(join(depsRoot, "node_modules"), { recursive: true });
  return depsRoot;
}

describe("stageFlowFiles — basename collision", () => {
  it("stages files with the same basename from different dirs into distinct subdir paths", async () => {
    const [runRoot, depsRoot, dirA, dirB] = await Promise.all([
      tracker.makeTmpDir(),
      makeDepsRoot(),
      tracker.makeTmpDir(),
      tracker.makeTmpDir(),
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
    tracker.track(result.runDir);

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
