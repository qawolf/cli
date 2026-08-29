import { afterEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";
import { makeDefaultFs } from "~/shell/fs.js";
import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";

import { handleLint } from "./handler.js";

const tracker = makeTmpDirTracker("qawolf-lint-handler-test-");

afterEach(() => tracker.cleanup());

async function inProject(
  filesByPath: Record<string, string>,
  run: () => Promise<void>,
): Promise<void> {
  const project = await tracker.makeTmpDir();
  await writeFile(join(project, "package.json"), "{}");
  await Promise.all(
    Object.entries(filesByPath).map(([filePath, content]) =>
      writeFile(join(project, filePath), content),
    ),
  );
  const previousCwd = process.cwd();
  process.chdir(project);
  try {
    await run();
  } finally {
    process.chdir(previousCwd);
  }
}

describe("handleLint", () => {
  it("succeeds without output when every file is clean", async () => {
    await inProject(
      { "clean.ts": "export const greeting = `hello`;\n" },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        expect(await handleLint(ctx, { files: ["clean.ts"] })).toBeUndefined();
        expect(ctx.ui.write).not.toHaveBeenCalled();
      },
    );
  });

  it("prints the report and fails when a file has an error", async () => {
    await inProject(
      {
        "broken.ts":
          "const value: any = 1;\nexport const doubled = value * 2;\n",
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        const result = await handleLint(ctx, { files: ["broken.ts"] });

        expect(result).toEqual({
          error: "1 lint error found",
          exitCode: exitCodes.testFailure,
        });
        expect(ctx.ui.write).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("succeeds when a file only has warnings", async () => {
    await inProject(
      {
        ".eslintrc.json": JSON.stringify({
          rules: { "@typescript-eslint/no-explicit-any": "warn" },
        }),
        "broken.ts":
          "const value: any = 1;\nexport const doubled = value * 2;\n",
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        expect(await handleLint(ctx, { files: ["broken.ts"] })).toBeUndefined();
        expect(ctx.ui.write).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("emits the report as data in json mode", async () => {
    await inProject(
      {
        "broken.ts":
          "const value: any = 1;\nexport const doubled = value * 2;\n",
      },
      async () => {
        const ctx = makeCtx("json", { fs: makeDefaultFs() });

        await handleLint(ctx, { files: ["broken.ts"] });

        expect(ctx.ui.json).toHaveBeenCalledTimes(1);
        expect(ctx.ui.write).not.toHaveBeenCalled();
      },
    );
  });

  it("treats a path it cannot read as invalid arguments", async () => {
    await inProject({}, async () => {
      const ctx = makeCtx("human", { fs: makeDefaultFs() });

      expect(await handleLint(ctx, { files: ["missing.ts"] })).toEqual({
        error: "missing.ts: no such file",
        exitCode: exitCodes.invalidArgs,
      });
    });
  });
});
