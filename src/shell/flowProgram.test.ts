import { expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFlowProgram } from "./flowProgram.js";

it("recognizes native Windows paths after TypeScript normalizes source file names", async () => {
  const bundleDir = await mkdtemp(join(tmpdir(), "qawolf-flow-program-"));
  const sourcePath = join(bundleDir, "a.flow.ts");
  try {
    await writeFile(sourcePath, "export default () => process.env.TOKEN;");
    const windowsPath = sourcePath.replaceAll("/", "\\");
    const result = await createFlowProgram({
      bundleDir,
      sourcePaths: [windowsPath],
    });
    expect(result.flowFiles).toHaveLength(1);
    expect(result.sourceFiles).toHaveLength(1);
    expect(result.isLocalFile(sourcePath.replaceAll("\\", "/"))).toBe(true);
    expect(result.isLocalFile(windowsPath)).toBe(true);
  } finally {
    await rm(bundleDir, { recursive: true, force: true });
  }
});
