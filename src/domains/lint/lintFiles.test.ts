import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";
import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";

import { lintFiles, type LintReport } from "./lintFiles.js";
import { formatLintReport } from "./renderLintReport.js";

const fs = makeDefaultFs();
const tracker = makeTmpDirTracker("qawolf-lint-test-");

afterEach(() => tracker.cleanup());

async function createProject(
  filesByPath: Record<string, string>,
): Promise<string> {
  const project = await tracker.makeTmpDir();
  await writeFile(join(project, "package.json"), "{}");
  await Promise.all(
    Object.entries(filesByPath).map(async ([filePath, content]) => {
      const absolutePath = join(project, filePath);
      await mkdir(join(absolutePath, ".."), { recursive: true });
      await writeFile(absolutePath, content);
    }),
  );
  return project;
}

function lint(cwd: string, filePaths: string[]): Promise<LintReport> {
  return lintFiles({
    cwd,
    filePaths: filePaths.map((filePath) => join(cwd, filePath)),
    fs,
  });
}

describe("lintFiles", () => {
  it("reports nothing for a clean file", async () => {
    const project = await createProject({
      "clean.flow.ts": "export const greeting = `hello`;\n",
    });

    const report = await lint(project, ["clean.flow.ts"]);

    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(formatLintReport(report)).toBe("");
  });

  it("reports an error with its position and rule, against the path as typed", async () => {
    const project = await createProject({
      "flows/broken.flow.ts":
        "const value: any = 1;\nexport const doubled = value * 2;\n",
    });

    const report = await lint(project, ["flows/broken.flow.ts"]);

    expect(report.errorCount).toBe(1);
    const output = formatLintReport(report);
    expect(output).toContain("flows/broken.flow.ts\n  1:14  error");
    expect(output).toContain("@typescript-eslint/no-explicit-any");
    expect(output).toContain("1 problem (1 error, 0 warnings)");
  });

  it("uses types from an imported file on disk", async () => {
    const project = await createProject({
      "helper.ts":
        "export type Options = { count: number };\nexport const options: Options = { count: 1 };\n",
      "uses-helper.flow.ts":
        'import { type Options, options } from "./helper.js";\n\nexport const count = (options as Options).count;\n',
    });

    const report = await lint(project, ["uses-helper.flow.ts"]);

    expect(report.errorCount).toBeGreaterThan(0);
    expect(formatLintReport(report)).toContain(
      "@typescript-eslint/no-unnecessary-type-assertion",
    );
  });

  it("applies the severity the team's .eslintrc.json asks for", async () => {
    const project = await createProject({
      ".eslintrc.json": JSON.stringify({
        rules: { "@typescript-eslint/no-explicit-any": "warn" },
      }),
      "broken.flow.ts":
        "const value: any = 1;\nexport const doubled = value * 2;\n",
    });

    const report = await lint(project, ["broken.flow.ts"]);

    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(1);
    expect(formatLintReport(report)).toContain(
      "warning  Unexpected any. Specify a different type.",
    );
  });

  it("finds the team's .eslintrc.json from a subdirectory", async () => {
    const project = await createProject({
      ".eslintrc.json": JSON.stringify({
        rules: { "@typescript-eslint/no-explicit-any": "off" },
      }),
      "src/flows/broken.flow.ts":
        "const value: any = 1;\nexport const doubled = value * 2;\n",
    });

    const report = await lintFiles({
      cwd: join(project, "src/flows"),
      filePaths: [join(project, "src/flows/broken.flow.ts")],
      fs,
    });

    expect(report.errorCount).toBe(0);
    expect(formatLintReport(report)).toBe("");
  });

  it("stops looking for .eslintrc.json above the project package", async () => {
    const outside = await tracker.makeTmpDir();
    await writeFile(
      join(outside, ".eslintrc.json"),
      JSON.stringify({
        rules: { "@typescript-eslint/no-explicit-any": "off" },
      }),
    );
    const project = join(outside, "project");
    await mkdir(project);
    await writeFile(join(project, "package.json"), "{}");
    await writeFile(
      join(project, "broken.flow.ts"),
      "const value: any = 1;\nexport const doubled = value * 2;\n",
    );

    const report = await lint(project, ["broken.flow.ts"]);

    expect(report.errorCount).toBe(1);
  });

  it("keeps a warning out of the error count", async () => {
    const project = await createProject({
      "unreachable.flow.ts":
        '/* eslint no-unreachable: "warn" */\nexport function run(): number {\n  return 1;\n  return 2;\n}\n',
    });

    const report = await lint(project, ["unreachable.flow.ts"]);

    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(1);
    expect(formatLintReport(report)).toContain("no-unreachable");
  });
});
