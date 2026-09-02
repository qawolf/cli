import { describe, expect, it } from "bun:test";

import { selectLintableFiles } from "./selectLintableFiles.js";

describe("selectLintableFiles", () => {
  it("keeps .ts and .js files, including declaration files", () => {
    expect(
      selectLintableFiles(
        [
          "/project/flows/login.flow.ts",
          "/project/src/pages/LoginPage.ts",
          "/project/scripts/seed.js",
          "/project/types/globals.d.ts",
        ],
        "/project",
      ),
    ).toEqual([
      "/project/flows/login.flow.ts",
      "/project/src/pages/LoginPage.ts",
      "/project/scripts/seed.js",
      "/project/types/globals.d.ts",
    ]);
  });

  it("drops files the linter cannot parse as source", () => {
    expect(
      selectLintableFiles(
        [
          "/project/data/fixture.json",
          "/project/README.md",
          "/project/flows/login.flow.tsx",
          "/project/Makefile",
        ],
        "/project",
      ),
    ).toEqual([]);
  });

  it("drops files under a generated output directory", () => {
    expect(
      selectLintableFiles(
        [
          "/project/flows/login.flow.ts",
          "/project/dist/flows/login.flow.js",
          "/project/build/bundle.js",
          "/project/coverage/lcov-report/block-navigation.js",
          "/project/.next/server/page.js",
        ],
        "/project",
      ),
    ).toEqual(["/project/flows/login.flow.ts"]);
  });

  it("keeps a file whose own name matches a generated directory", () => {
    expect(selectLintableFiles(["/project/flows/dist.ts"], "/project")).toEqual(
      ["/project/flows/dist.ts"],
    );
  });

  it("ignores generated directory names above the project root", () => {
    expect(
      selectLintableFiles(
        ["/home/me/build/project/flows/a.flow.ts"],
        "/home/me/build/project",
      ),
    ).toEqual(["/home/me/build/project/flows/a.flow.ts"]);
  });
});
