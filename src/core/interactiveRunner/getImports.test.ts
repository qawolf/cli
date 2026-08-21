import { describe, expect, it } from "bun:test";
import typescript from "typescript";

import { getImports } from "./getImports.js";

const importsOf = (content: string, path = "src/flows/checkout.flow.ts") =>
  getImports({
    content,
    path,
    tsconfigPaths: { "~/*": ["src/*"] },
    typescript,
  });

describe("getImports", () => {
  it("collects relative and aliased static imports", () => {
    expect(
      importsOf(`
        import { login } from "../pages/login";
        import type { Cart } from "~/types/cart";
        export default {};
      `),
    ).toEqual(["../pages/login", "~/types/cart"]);
  });

  it("leaves bare specifiers to npm", () => {
    expect(
      importsOf(`
        import { expect } from "playwright";
        import { flow } from "@qawolf/flows";
        import { login } from "./login";
      `),
    ).toEqual(["./login"]);
  });

  it("collects a dynamic import anywhere in the file, awaited or not", () => {
    expect(
      importsOf(`
        const lazy = () => import("./lazy");
        async function run() {
          const eager = await import("~/pages/login");
          return eager;
        }
      `),
    ).toEqual(["./lazy", "~/pages/login"]);
  });

  it("reports a path once when it is both statically and dynamically imported", () => {
    expect(
      importsOf(`
        import type { Page } from "./page";
        const lazy = () => import("./page");
      `),
    ).toEqual(["./page"]);
  });

  it("ignores a dynamic import whose specifier is not a literal", () => {
    expect(importsOf("const load = (p: string) => import(p);")).toEqual([]);
  });

  it("does not see export-from or require, matching the socket path", () => {
    expect(
      importsOf(`
        export { login } from "./login";
        export * from "./helpers";
        const legacy = require("./legacy");
      `),
    ).toEqual([]);
  });

  it("parses a tsx file as tsx, from the filename", () => {
    expect(
      importsOf(
        'import { Widget } from "./widget";\nconst node = <Widget />;',
        "src/flows/checkout.flow.tsx",
      ),
    ).toEqual(["./widget"]);
  });

  it("collects nothing from a file that imports nothing", () => {
    expect(importsOf("export default {};")).toEqual([]);
  });
});
