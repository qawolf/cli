import { describe, expect, it } from "bun:test";
import typescript from "typescript";

import { rewriteAliasImports } from "./rewriteAliasImports.js";
import type { TsconfigPaths } from "./tsconfigPaths.js";

const tsconfigPaths: TsconfigPaths = {
  "@flows/*": ["src/flows/*"],
  "@pages/*": ["src/pages/*"],
  "@utilities/*": ["src/utilities/*"],
};

const projectFilePaths = new Set([
  "src/flows/checkout.flow.ts",
  "src/flows/shared.ts",
  "src/pages/login/index.ts",
  "src/utilities/gptHelpers.ts",
  "src/utilities/legacy.js",
]);

function rewrite(
  code: string,
  importingFilePath = "src/flows/checkout.flow.ts",
): string {
  return rewriteAliasImports({
    code,
    importingFilePath,
    projectFilePaths,
    tsconfigPaths,
    typescript,
  });
}

describe("rewriteAliasImports", () => {
  it("rewrites an alias naming a source file to a relative specifier", () => {
    expect(rewrite('import { ask } from "@utilities/gptHelpers.ts";')).toBe(
      'import { ask } from "../utilities/gptHelpers.ts";',
    );
  });

  it("rewrites an extensionless alias", () => {
    expect(rewrite('import { ask } from "@utilities/gptHelpers";')).toBe(
      'import { ask } from "../utilities/gptHelpers.ts";',
    );
  });

  it("prefixes a same-directory target so it stays a relative specifier", () => {
    expect(rewrite('import { shared } from "@flows/shared.ts";')).toBe(
      'import { shared } from "./shared.ts";',
    );
  });

  it("resolves a directory alias through its index file", () => {
    expect(rewrite('import { login } from "@pages/login";')).toBe(
      'import { login } from "../pages/login/index.ts";',
    );
  });

  it("resolves a .js specifier to the TypeScript file on disk", () => {
    expect(rewrite('import { ask } from "@utilities/gptHelpers.js";')).toBe(
      'import { ask } from "../utilities/gptHelpers.ts";',
    );
  });

  it("rewrites a dynamic import and a re-export", () => {
    expect(rewrite('const m = await import("@utilities/gptHelpers.ts");')).toBe(
      'const m = await import("../utilities/gptHelpers.ts");',
    );
    expect(rewrite('export { ask } from "@utilities/gptHelpers.ts";')).toBe(
      'export { ask } from "../utilities/gptHelpers.ts";',
    );
  });

  it("keeps the quote character the source used", () => {
    expect(rewrite("import { ask } from '@utilities/gptHelpers.ts';")).toBe(
      "import { ask } from '../utilities/gptHelpers.ts';",
    );
  });

  it("leaves packages, builtins and subpath imports alone", () => {
    const code = [
      'import { readFile } from "node:fs/promises";',
      'import { expect } from "playwright";',
      'import { chromium } from "#playwright";',
      'import { page } from "./page.ts";',
    ].join("\n");
    expect(rewrite(code)).toBe(code);
  });

  it("leaves an alias whose target is not in the project alone", () => {
    const code = 'import { gone } from "@utilities/missing.ts";';
    expect(rewrite(code)).toBe(code);
  });

  it("leaves the code alone when the project declares no aliases", () => {
    const code = 'import { ask } from "@utilities/gptHelpers.ts";';
    expect(
      rewriteAliasImports({
        code,
        importingFilePath: "src/flows/checkout.flow.ts",
        projectFilePaths,
        tsconfigPaths: undefined,
        typescript,
      }),
    ).toBe(code);
  });

  it("rewrites every alias in a file without moving any other line", () => {
    const code = [
      'import { ask } from "@utilities/gptHelpers.ts";',
      'import { login } from "@pages/login";',
      'import { shared } from "@flows/shared.ts";',
      "",
      "export default async function run() {",
      "  await login();",
      "  return ask(shared);",
      "}",
      "",
    ].join("\n");
    const rewritten = rewrite(code);

    expect(rewritten.split("\n")).toEqual([
      'import { ask } from "../utilities/gptHelpers.ts";',
      'import { login } from "../pages/login/index.ts";',
      'import { shared } from "./shared.ts";',
      "",
      "export default async function run() {",
      "  await login();",
      "  return ask(shared);",
      "}",
      "",
    ]);
  });

  it("rewrites relative to the importing file, not the project root", () => {
    expect(
      rewrite(
        'import { ask } from "@utilities/gptHelpers.ts";',
        "src/pages/login/index.ts",
      ),
    ).toBe('import { ask } from "../../utilities/gptHelpers.ts";');
  });
  it("leaves a type-only import alone, as the platform runner does", () => {
    const code = 'import type { Helper } from "@utilities/gptHelpers.ts";';
    expect(rewrite(code)).toBe(code);
  });

  it("rewrites from a file sitting at the project root", () => {
    expect(
      rewrite(
        'import { ask } from "@utilities/gptHelpers.ts";',
        "smoke.flow.ts",
      ),
    ).toBe('import { ask } from "./src/utilities/gptHelpers.ts";');
  });
});
