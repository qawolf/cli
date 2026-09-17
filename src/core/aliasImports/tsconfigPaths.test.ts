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
  it("prefers an exact pattern over a wildcard that also matches", () => {
    expect(
      resolvePathAlias("@pages/login", {
        "@pages/*": ["src/pages/*"],
        "@pages/login": ["src/pages/legacyLogin.ts"],
      }),
    ).toBe("src/pages/legacyLogin.ts");
  });

  it("prefers the longest prefix whatever order the patterns are written in", () => {
    const paths = {
      "@utilities/*": ["src/utilities/*"],
      "@utilities/email/*": ["src/utilities/email/*"],
    };
    expect(resolvePathAlias("@utilities/email/inbox", paths)).toBe(
      "src/utilities/email/inbox",
    );
    expect(
      resolvePathAlias("@utilities/email/inbox", {
        "@utilities/email/*": ["src/utilities/email/*"],
        "@utilities/*": ["src/utilities/*"],
      }),
    ).toBe("src/utilities/email/inbox");
  });

  it("requires the text after the wildcard to match too", () => {
    const paths = { "@lib/*.js": ["src/lib/*.js"] };
    expect(resolvePathAlias("@lib/helper.js", paths)).toBe("src/lib/helper.js");
    expect(resolvePathAlias("@lib/helper.ts", paths)).toBeUndefined();
  });

  it("ignores a pattern carrying more than one wildcard", () => {
    expect(
      resolvePathAlias("@lib/a/b", { "@lib/*/*": ["src/*/*"] }),
    ).toBeUndefined();
  });

  it("matches everything through a catch-all pattern", () => {
    expect(resolvePathAlias("pages/login", { "*": ["src/*"] })).toBe(
      "src/pages/login",
    );
  });
});
