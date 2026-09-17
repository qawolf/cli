import { describe, expect, it } from "bun:test";

import { flowFailureHint } from "./flowFailureHint.js";

describe("flowFailureHint", () => {
  it("names the project package.json when a project dir is known", () => {
    const hint = flowFailureHint(
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'date-fns' imported from /x/y.js",
      "/proj",
    );
    expect(hint).toBe(
      "Hint: 'date-fns' could not be resolved. Ensure it is declared in /proj/package.json \"dependencies\" and run npm install in that project.",
    );
  });

  it("tells the user to run from their project when no project dir is known", () => {
    const hint = flowFailureHint("Cannot find package 'date-fns'", undefined);
    expect(hint).toBe(
      "Hint: 'date-fns' could not be resolved. Run from within your flows project so its dependencies can be found.",
    );
  });

  it("returns undefined for a failure that is not a module resolution error", () => {
    expect(flowFailureHint("locator timeout", "/proj")).toBeUndefined();
  });
  it("points an unresolved path alias at tsconfig rather than at npm", () => {
    const hint = flowFailureHint(
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@utilities/gpt-helpers.ts' imported from /run/exec/src/pages/admin.ts",
      "/proj",
    );
    expect(hint).toBe(
      "Hint: '@utilities/gpt-helpers.ts' looks like a tsconfig path alias. Ensure \"compilerOptions.paths\" in /proj/tsconfig.json maps it to a file that exists.",
    );
  });

  it("tells the user to run from their project when an alias fails with no project dir", () => {
    const hint = flowFailureHint(
      "Cannot find package '@utilities/gpt-helpers.ts'",
      undefined,
    );
    expect(hint).toBe(
      "Hint: '@utilities/gpt-helpers.ts' looks like a tsconfig path alias. Run from within your flows project so its tsconfig.json can be found.",
    );
  });
});
