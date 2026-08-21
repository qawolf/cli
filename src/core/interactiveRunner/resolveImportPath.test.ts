import { describe, expect, it } from "bun:test";

import { resolveImportPath } from "./resolveImportPath.js";

const held = new Set([
  "package.json",
  "src/flows/checkout.flow.ts",
  "src/helpers.js",
  "src/pages/index.ts",
  "src/pages/login.ts",
]);

const resolve = (
  importPath: string,
  importingFilePath = "src/flows/checkout.flow.ts",
) =>
  resolveImportPath({
    importPath,
    importingFilePath,
    repositoryFilePaths: held,
    tsconfigPaths: { "~/*": ["src/*"] },
  });

describe("resolveImportPath", () => {
  it("resolves a relative import against the importing file's directory", () => {
    expect(resolve("../pages/login")).toEqual({
      path: "src/pages/login.ts",
      type: "resolved",
    });
  });

  it("resolves an alias target against the project root", () => {
    expect(resolve("~/pages/login")).toEqual({
      path: "src/pages/login.ts",
      type: "resolved",
    });
  });

  it("tries .ts, .js, /index.ts then /index.js, and never the bare path", () => {
    expect(resolve("../helpers")).toEqual({
      path: "src/helpers.js",
      type: "resolved",
    });
    expect(resolve("../pages")).toEqual({
      path: "src/pages/index.ts",
      type: "resolved",
    });
    expect(
      resolveImportPath({
        importPath: "./bare",
        importingFilePath: "src/flow.ts",
        repositoryFilePaths: new Set(["src/bare"]),
        tsconfigPaths: undefined,
      }),
    ).toEqual({ type: "unresolved-repository-import" });
  });

  it("tries the other supported extension when one is explicit", () => {
    expect(resolve("../pages/login.js")).toEqual({
      path: "src/pages/login.ts",
      type: "resolved",
    });
    expect(resolve("../helpers.ts")).toEqual({
      path: "src/helpers.js",
      type: "resolved",
    });
  });

  it("does not reach an extension the resolver does not try", () => {
    expect(
      resolveImportPath({
        importPath: "./widget.tsx",
        importingFilePath: "src/flow.ts",
        repositoryFilePaths: new Set(["src/widget.tsx"]),
        tsconfigPaths: undefined,
      }),
    ).toEqual({ type: "unresolved-repository-import" });
  });

  it("leaves a bare specifier to npm rather than reporting it", () => {
    expect(resolve("playwright")).toEqual({ type: "not-a-repository-import" });
    expect(resolve("@qawolf/flows")).toEqual({
      type: "not-a-repository-import",
    });
  });

  it("reports a relative or aliased import that matches nothing", () => {
    expect(resolve("./missing")).toEqual({
      type: "unresolved-repository-import",
    });
    expect(resolve("~/missing")).toEqual({
      type: "unresolved-repository-import",
    });
  });

  it("resolves with forward slashes whatever the platform separator is", () => {
    expect(resolve("./nested/../../pages/login")).toEqual({
      path: "src/pages/login.ts",
      type: "resolved",
    });
  });
});
