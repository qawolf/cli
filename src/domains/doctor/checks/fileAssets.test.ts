import { describe, expect, it } from "bun:test";

import {
  checkFileAssets,
  fileAssetsWarnReasons,
  scanFileAssetReferences,
} from "./fileAssets.js";

describe("scanFileAssetReferences", () => {
  it("matches process.env references (named or destructured)", () => {
    expect(
      scanFileAssetReferences("process.env.QAWOLF_SCREENSHOTS_DIR;"),
    ).toEqual(["QAWOLF_SCREENSHOTS_DIR"]);
    expect(
      scanFileAssetReferences("const { QAWOLF_DOWNLOADS_DIR } = process.env;"),
    ).toEqual(["QAWOLF_DOWNLOADS_DIR"]);
  });

  it("matches multiple distinct vars and dedupes repeats", () => {
    const source = `
      const a = process.env.QAWOLF_SCREENSHOTS_DIR;
      const b = process.env.QAWOLF_DOWNLOADS_DIR;
      const c = process.env.QAWOLF_SCREENSHOTS_DIR; // repeat
    `;
    expect(scanFileAssetReferences(source).sort()).toEqual([
      "QAWOLF_DOWNLOADS_DIR",
      "QAWOLF_SCREENSHOTS_DIR",
    ]);
  });

  it("returns no matches for unrelated env vars", () => {
    expect(
      scanFileAssetReferences("process.env.QAWOLF_API_KEY; process.env.HOME;"),
    ).toEqual([]);
  });

  it("returns no matches for partial-name lookalikes", () => {
    expect(
      scanFileAssetReferences("MY_QAWOLF_FOO_DIR_THING; QAWOLF__DIR;"),
    ).toEqual([]);
  });

  it("matches a string literal in a comment (acceptable false-positive surface)", () => {
    expect(
      scanFileAssetReferences("// see QAWOLF_SCREENSHOTS_DIR for details"),
    ).toEqual(["QAWOLF_SCREENSHOTS_DIR"]);
  });

  it("matches exact-name patterns (TEAM_STORAGE_DIR, RUN_INPUT_PATH)", () => {
    expect(
      scanFileAssetReferences(
        "process.env.TEAM_STORAGE_DIR; process.env.RUN_INPUT_PATH;",
      ).sort(),
    ).toEqual(["RUN_INPUT_PATH", "TEAM_STORAGE_DIR"]);
  });

  it("matches the RUN_*_DIR prefix family", () => {
    expect(
      scanFileAssetReferences(
        "process.env.RUN_INPUTS_EXECUTABLES_DIR; process.env.RUN_OUTPUTS_DIR;",
      ).sort(),
    ).toEqual(["RUN_INPUTS_EXECUTABLES_DIR", "RUN_OUTPUTS_DIR"]);
  });

  it("does not match TEAM_STORAGE on its own (no _DIR suffix)", () => {
    expect(
      scanFileAssetReferences("process.env.TEAM_STORAGE; process.env.RUN_DIR;"),
    ).toEqual([]);
  });
});

function readerFor(
  map: Record<string, string>,
): (path: string) => Promise<string> {
  return async (path) => {
    const source = map[path];
    if (source === undefined) throw new Error(`unexpected read: ${path}`);
    return source;
  };
}

describe("checkFileAssets", () => {
  it("returns no results when no files reference file-asset vars", async () => {
    const results = await checkFileAssets({
      files: ["/repo/a.flow.ts", "/repo/b.flow.ts"],
      readFile: readerFor({
        "/repo/a.flow.ts": 'flow("A", async () => {})',
        "/repo/b.flow.ts": "process.env.QAWOLF_API_KEY;",
      }),
      cwd: "/repo",
    });
    expect(results).toEqual([]);
  });

  it("emits one warn per file with matches, listing every var", async () => {
    const results = await checkFileAssets({
      files: ["/repo/flows/login.flow.ts", "/repo/flows/upload.flow.ts"],
      readFile: readerFor({
        "/repo/flows/login.flow.ts": 'flow("Login", async () => {})',
        "/repo/flows/upload.flow.ts": `
          process.env.QAWOLF_SCREENSHOTS_DIR;
          process.env.QAWOLF_DOWNLOADS_DIR;
        `,
      }),
      cwd: "/repo",
    });
    expect(results).toHaveLength(1);
    const [result] = results;
    expect(result?.name).toBe("file-assets");
    expect(result?.status).toBe("warn");
    expect(result?.detail).toContain("flows/upload.flow.ts");
    expect(result?.detail).toContain("QAWOLF_SCREENSHOTS_DIR");
    expect(result?.detail).toContain("QAWOLF_DOWNLOADS_DIR");
    expect(result?.detail).toContain(fileAssetsWarnReasons["file-asset"]);
  });

  it("emits separate warns per category when a file mixes web and mobile vars", async () => {
    const results = await checkFileAssets({
      files: ["/repo/flows/mixed.flow.ts"],
      readFile: readerFor({
        "/repo/flows/mixed.flow.ts": `
          process.env.QAWOLF_SCREENSHOTS_DIR;
          process.env.RUN_INPUTS_EXECUTABLES_DIR;
        `,
      }),
      cwd: "/repo",
    });
    expect(results).toHaveLength(2);
    const fileAsset = results.find((r) =>
      r.detail?.includes(fileAssetsWarnReasons["file-asset"]),
    );
    const mobileInput = results.find((r) =>
      r.detail?.includes(fileAssetsWarnReasons["mobile-input"]),
    );
    expect(fileAsset?.detail).toContain("QAWOLF_SCREENSHOTS_DIR");
    expect(fileAsset?.detail).not.toContain("RUN_INPUTS_EXECUTABLES_DIR");
    expect(mobileInput?.detail).toContain("RUN_INPUTS_EXECUTABLES_DIR");
    expect(mobileInput?.detail).not.toContain("QAWOLF_SCREENSHOTS_DIR");
  });

  it("uses the mobile-input reason for RUN_*_DIR and RUN_INPUT_PATH", async () => {
    const results = await checkFileAssets({
      files: ["/repo/dir.flow.ts", "/repo/path.flow.ts"],
      readFile: readerFor({
        "/repo/dir.flow.ts": "process.env.RUN_INPUTS_EXECUTABLES_DIR;",
        "/repo/path.flow.ts": "process.env.RUN_INPUT_PATH;",
      }),
      cwd: "/repo",
    });
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.detail).toContain(fileAssetsWarnReasons["mobile-input"]);
      expect(result.detail).not.toContain(fileAssetsWarnReasons["file-asset"]);
    }
  });

  it("displays paths relative to cwd when possible", async () => {
    const [result] = await checkFileAssets({
      files: ["/repo/flows/login.flow.ts"],
      readFile: readerFor({
        "/repo/flows/login.flow.ts": "process.env.QAWOLF_VIDEOS_DIR;",
      }),
      cwd: "/repo",
    });
    expect(result?.detail).toMatch(/^flows\/login\.flow\.ts /);
  });

  it("falls back to the absolute path when cwd is the same as the file", async () => {
    const [result] = await checkFileAssets({
      files: ["/repo/flows/login.flow.ts"],
      readFile: readerFor({
        "/repo/flows/login.flow.ts": "process.env.QAWOLF_VIDEOS_DIR;",
      }),
      cwd: "/repo/flows/login.flow.ts",
    });
    expect(result?.detail).toContain("/repo/flows/login.flow.ts");
  });

  it("warns instead of throwing when a file is unreadable", async () => {
    const results = await checkFileAssets({
      files: ["/repo/flows/locked.flow.ts", "/repo/flows/clean.flow.ts"],
      readFile: async (path) => {
        if (path === "/repo/flows/locked.flow.ts") {
          throw new Error("EACCES: permission denied");
        }
        return 'flow("Clean", async () => {})';
      },
      cwd: "/repo",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("warn");
    expect(results[0]?.detail).toContain("flows/locked.flow.ts");
    expect(results[0]?.detail).toContain("could not be read");
    expect(results[0]?.detail).toContain("EACCES");
  });
});
