import { describe, expect, it } from "bun:test";

import { findPulledEnvDir, toRepoRelativePath } from "./repoRelativePath.js";

describe("findPulledEnvDir", () => {
  it("finds the env dir whose parent is .qawolf", () => {
    expect(
      findPulledEnvDir("/repo/.qawolf/staging/src/flows/a/b.flow.ts"),
    ).toBe("/repo/.qawolf/staging");
  });

  it("finds it when the flow sits directly in the env dir", () => {
    expect(findPulledEnvDir("/repo/.qawolf/staging/b.flow.ts")).toBe(
      "/repo/.qawolf/staging",
    );
  });

  it("returns undefined outside a pulled env tree", () => {
    expect(findPulledEnvDir("/repo/src/flows/a/b.flow.ts")).toBeUndefined();
  });

  // `.qawolf` itself is not an env dir — the env is the directory beneath it.
  it("returns undefined for a file directly inside .qawolf", () => {
    expect(findPulledEnvDir("/repo/.qawolf/b.flow.ts")).toBeUndefined();
  });
});

describe("toRepoRelativePath", () => {
  it("strips the pulled env prefix so the path is repo-relative", () => {
    expect(
      toRepoRelativePath(
        "/repo/.qawolf/staging/src/flows/a/b.flow.ts",
        "/repo",
      ),
    ).toBe("src/flows/a/b.flow.ts");
  });

  it("ignores cwd for a pulled flow", () => {
    expect(
      toRepoRelativePath(
        "/repo/.qawolf/staging/src/flows/a/b.flow.ts",
        "/somewhere/else",
      ),
    ).toBe("src/flows/a/b.flow.ts");
  });

  it("falls back to a path relative to cwd for a project flow", () => {
    expect(toRepoRelativePath("/repo/src/flows/a/b.flow.ts", "/repo")).toBe(
      "src/flows/a/b.flow.ts",
    );
  });
});
