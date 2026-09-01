import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeCtx } from "~/shell/commandContext.testUtils.js";
import { exitCodes } from "~/shell/exit.js";
import { makeDefaultFs } from "~/shell/fs.js";
import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";

import { handleFlowsLint } from "./lintDefaults.js";

const tracker = makeTmpDirTracker("qawolf-flows-lint-test-");

afterEach(() => tracker.cleanup());

const brokenFlow = "const value: any = 1;\nexport const doubled = value * 2;\n";
const cleanFlow = "export const greeting = `hello`;\n";

async function inProject(
  filesByPath: Record<string, string>,
  run: () => Promise<void>,
): Promise<void> {
  const project = await tracker.makeTmpDir();
  await writeFile(join(project, "package.json"), "{}");
  await Promise.all(
    Object.entries(filesByPath).map(async ([filePath, content]) => {
      const absolutePath = join(project, filePath);
      await mkdir(join(absolutePath, ".."), { recursive: true });
      await writeFile(absolutePath, content);
    }),
  );
  const previousCwd = process.cwd();
  process.chdir(project);
  try {
    await run();
  } finally {
    process.chdir(previousCwd);
  }
}

function writtenText(ctx: ReturnType<typeof makeCtx>): string {
  return (ctx.ui.write as unknown as { mock: { calls: string[][] } }).mock.calls
    .map((call) => call[0])
    .join("");
}

describe("handleFlowsLint", () => {
  it("lints every source file in the project when no pattern is given", async () => {
    await inProject(
      {
        "flows/broken.flow.ts": brokenFlow,
        "flows/nested/also-broken.flow.ts": brokenFlow,
        "helpers/not-a-flow.ts": brokenFlow,
        "src/pages/LoginPage.ts": brokenFlow,
        "data/fixture.json": '{ "value": 1 }\n',
        "node_modules/dep/dep.flow.ts": brokenFlow,
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        const result = await handleFlowsLint(ctx, undefined, {
          allowNoMatch: false,
        });

        expect(result).toEqual({
          error: "4 lint errors found",
          exitCode: exitCodes.testFailure,
        });
        const output = writtenText(ctx);
        expect(output).toContain("flows/broken.flow.ts");
        expect(output).toContain(
          join("flows", "nested", "also-broken.flow.ts"),
        );
        expect(output).toContain(join("helpers", "not-a-flow.ts"));
        expect(output).toContain(join("src", "pages", "LoginPage.ts"));
        expect(output).not.toContain("fixture.json");
        expect(output).not.toContain("dep.flow.ts");
      },
    );
  });

  it("ignores the files a pattern matches that are not lintable", async () => {
    await inProject(
      {
        "flows/broken.flow.ts": brokenFlow,
        "flows/fixture.json": '{ "value": 1 }\n',
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        const result = await handleFlowsLint(ctx, "flows/*", {
          allowNoMatch: false,
        });

        expect(result).toEqual({
          error: "1 lint error found",
          exitCode: exitCodes.testFailure,
        });
        expect(writtenText(ctx)).not.toContain("fixture.json");
      },
    );
  });

  it("treats a pattern that matches only unlintable files as no match", async () => {
    await inProject(
      {
        "flows/broken.flow.ts": brokenFlow,
        "data/fixture.json": '{ "value": 1 }\n',
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        const result = await handleFlowsLint(ctx, "data/**", {
          allowNoMatch: false,
        });

        expect(result).toEqual({
          error:
            "No lintable source files matched 'data/**'. Pass --allow-no-match to exit 0 instead.",
          exitCode: exitCodes.invalidArgs,
        });
        expect(ctx.ui.write).not.toHaveBeenCalled();
      },
    );
  });

  it("lints only the files a pattern selects", async () => {
    await inProject(
      {
        "flows/checkout/pay.flow.ts": brokenFlow,
        "flows/login.flow.ts": brokenFlow,
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        const result = await handleFlowsLint(ctx, "flows/checkout/**", {
          allowNoMatch: false,
        });

        expect(result).toEqual({
          error: "1 lint error found",
          exitCode: exitCodes.testFailure,
        });
        expect(writtenText(ctx)).not.toContain("login.flow.ts");
      },
    );
  });

  it("succeeds without output when every file is clean", async () => {
    await inProject({ "flows/clean.flow.ts": cleanFlow }, async () => {
      const ctx = makeCtx("human", { fs: makeDefaultFs() });

      const result = await handleFlowsLint(ctx, undefined, {
        allowNoMatch: false,
      });

      expect(result).toBeUndefined();
      expect(ctx.ui.write).not.toHaveBeenCalled();
    });
  });

  it("succeeds when a file only has warnings", async () => {
    await inProject(
      {
        ".eslintrc.json": JSON.stringify({
          rules: { "@typescript-eslint/no-explicit-any": "warn" },
        }),
        "flows/broken.flow.ts": brokenFlow,
      },
      async () => {
        const ctx = makeCtx("human", { fs: makeDefaultFs() });

        const result = await handleFlowsLint(ctx, undefined, {
          allowNoMatch: false,
        });

        expect(result).toBeUndefined();
        expect(writtenText(ctx)).toContain("1 problem (0 errors, 1 warning)");
      },
    );
  });

  it("emits the report as data in json mode", async () => {
    await inProject({ "flows/broken.flow.ts": brokenFlow }, async () => {
      const ctx = makeCtx("json", { fs: makeDefaultFs() });

      await handleFlowsLint(ctx, undefined, { allowNoMatch: false });

      expect(ctx.ui.json).toHaveBeenCalledTimes(1);
      expect(ctx.ui.write).not.toHaveBeenCalled();
    });
  });

  it("fails when the pattern selects no file", async () => {
    await inProject({ "flows/clean.flow.ts": cleanFlow }, async () => {
      const ctx = makeCtx("human", { fs: makeDefaultFs() });

      const result = await handleFlowsLint(ctx, "flows/checkout/**", {
        allowNoMatch: false,
      });

      expect(result).toEqual({
        error:
          "No lintable source files matched 'flows/checkout/**'. Pass --allow-no-match to exit 0 instead.",
        exitCode: exitCodes.invalidArgs,
      });
    });
  });

  it("succeeds on no match with --allow-no-match", async () => {
    await inProject({ "flows/clean.flow.ts": cleanFlow }, async () => {
      const ctx = makeCtx("human", { fs: makeDefaultFs() });

      const result = await handleFlowsLint(ctx, "flows/checkout/**", {
        allowNoMatch: true,
      });

      expect(result).toBeUndefined();
      expect(ctx.ui.info).toHaveBeenCalledWith(
        "No lintable source files matched.",
      );
    });
  });
});
