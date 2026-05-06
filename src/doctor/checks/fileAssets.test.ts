import { describe, expect, it } from "bun:test";

import {
  checkFileAssets,
  fileAssetsWarnReason,
  scanFileAssetReferences,
} from "./fileAssets.js";

describe("scanFileAssetReferences", () => {
  it("matches a process.env reference", () => {
    expect(
      scanFileAssetReferences(
        "const dir = process.env.QAWOLF_SCREENSHOTS_DIR;",
      ),
    ).toEqual(["QAWOLF_SCREENSHOTS_DIR"]);
  });

  it("matches a destructured env reference", () => {
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
    expect(result?.detail).toContain(fileAssetsWarnReason);
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
});
