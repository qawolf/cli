import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";
import { prepareRunDir } from "./prepareRunDir.js";

const tracker = makeTmpDirTracker("qawolf-stage-outside-test-");

afterEach(() => tracker.cleanup());

describe("stageFlowFiles — file outside projectDir", () => {
  it("stages it into exec/ instead of returning the source path", async () => {
    const [runRoot, depsRoot, outerDir] = await Promise.all([
      tracker.makeTmpDir(),
      tracker.makeTmpDir(),
      tracker.makeTmpDir(),
    ]);
    await mkdir(join(depsRoot, "node_modules"), { recursive: true });
    const projectDir = join(outerDir, "pkg");
    await mkdir(projectDir, { recursive: true });
    const insideFlow = join(projectDir, "inside.ts");
    const outsideFlow = join(outerDir, "outside.ts");
    await Promise.all([
      writeFile(insideFlow, "// inside"),
      writeFile(outsideFlow, "// outside"),
    ]);

    const result = await prepareRunDir({
      files: [insideFlow, outsideFlow],
      projectDir,
      depsRoot,
      runRoot,
    });
    tracker.track(result.runDir);

    const execDir = join(result.runDir, "exec");
    const [stagedInside, stagedOutside] = result.files;
    if (stagedInside === undefined || stagedOutside === undefined) {
      throw new Error("expected 2 staged file paths");
    }
    expect(stagedInside).toBe(join(execDir, "inside.ts"));
    expect(stagedOutside.startsWith(execDir + sep)).toBe(true);
    expect(await readFile(stagedOutside, "utf-8")).toBe("// outside");
  });
});
