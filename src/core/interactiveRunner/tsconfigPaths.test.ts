import { describe, expect, it } from "bun:test";

import { parseTsconfigPaths, resolvePathAlias } from "./tsconfigPaths.js";

describe("parseTsconfigPaths", () => {
  it("reads compilerOptions.paths", () => {
    expect(
      parseTsconfigPaths('{"compilerOptions":{"paths":{"~/*":["src/*"]}}}'),
    ).toEqual({ "~/*": ["src/*"] });
  });

  it("contributes nothing rather than throwing", () => {
    expect(parseTsconfigPaths("{ not json")).toBeUndefined();
    expect(parseTsconfigPaths("[]")).toBeUndefined();
    expect(parseTsconfigPaths("{}")).toBeUndefined();
    expect(parseTsconfigPaths('{"compilerOptions":{}}')).toBeUndefined();
    expect(
      parseTsconfigPaths('{"compilerOptions":{"paths":"~/*"}}'),
    ).toBeUndefined();
    expect(
      parseTsconfigPaths('{"compilerOptions":{"paths":{"~/*":[1]}}}'),
    ).toBeUndefined();
  });
});

describe("resolvePathAlias", () => {
  const paths = { "@pages/*": ["src/pages/*"], "~/*": ["src/*"] };

  it("substitutes the suffix into the target", () => {
    expect(resolvePathAlias("~/pages/login", paths)).toBe("src/pages/login");
    expect(resolvePathAlias("@pages/login", paths)).toBe("src/pages/login");
  });

  it("matches a pattern with no wildcard by its whole name", () => {
    expect(resolvePathAlias("~config", { "~config": ["src/config.ts"] })).toBe(
      "src/config.ts",
    );
  });

  it("answers nothing for an import no pattern prefixes", () => {
    expect(resolvePathAlias("playwright", paths)).toBeUndefined();
    expect(resolvePathAlias("./relative", paths)).toBeUndefined();
    expect(resolvePathAlias("~/anything", undefined)).toBeUndefined();
  });

  it("honours only the first target", () => {
    expect(resolvePathAlias("~/page", { "~/*": ["first/*", "second/*"] })).toBe(
      "first/page",
    );
  });

  it("answers nothing for a pattern naming no target", () => {
    expect(resolvePathAlias("~/page", { "~/*": [] })).toBeUndefined();
  });
});
