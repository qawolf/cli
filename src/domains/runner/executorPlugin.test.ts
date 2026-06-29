import { describe, expect, it } from "bun:test";

import { createExternalizeExecutorPlugin } from "./executorPlugin.js";

// The onResolve filter must match both Unix and Windows absolute paths so that
// externalization works when the CLI binary is built on Windows.
const onResolveFilter = /^([A-Za-z]:[\\/]|\/).*\.(js|mjs|cjs|ts|tsx)$/;

describe("onResolve filter regex", () => {
  it("matches Unix absolute paths", () => {
    expect(onResolveFilter.test("/abs/path/to/file.js")).toBe(true);
    expect(onResolveFilter.test("/abs/path/to/file.ts")).toBe(true);
    expect(onResolveFilter.test("/abs/path/to/file.mjs")).toBe(true);
  });

  it("matches Windows drive-absolute paths with backslash", () => {
    expect(onResolveFilter.test("C:\\abs\\path\\to\\file.js")).toBe(true);
    expect(onResolveFilter.test("C:\\abs\\path\\to\\file.ts")).toBe(true);
    expect(onResolveFilter.test("c:\\abs\\path\\to\\file.mjs")).toBe(true);
  });

  it("matches Windows drive-absolute paths with forward slash", () => {
    expect(onResolveFilter.test("C:/abs/path/to/file.js")).toBe(true);
    expect(onResolveFilter.test("D:/abs/path/to/file.tsx")).toBe(true);
  });

  it("does not match bare module specifiers", () => {
    expect(onResolveFilter.test("@qawolf/flows")).toBe(false);
    expect(onResolveFilter.test("node:path")).toBe(false);
    expect(onResolveFilter.test("relative/path.js")).toBe(false);
  });

  it("does not match paths without a recognized extension", () => {
    expect(onResolveFilter.test("/abs/path/to/file.py")).toBe(false);
    expect(onResolveFilter.test("C:\\abs\\path\\to\\file.json")).toBe(false);
  });
});

describe("createExternalizeExecutorPlugin", () => {
  it("returns a plugin with the correct name", () => {
    const fakeFs = {
      readFile: async () => "",
    };
    const plugin = createExternalizeExecutorPlugin(
      "/fake/deps",
      fakeFs as never,
    );
    expect(plugin.name).toBe("externalize-executor-packages");
  });
});
