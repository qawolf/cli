import { describe, expect, it } from "bun:test";

import {
  buildRunFileDelta,
  hashRunFile,
  toRunFilesManifest,
} from "./fileDelta.js";

const flowPath = "src/flows/checkout.flow.ts";
const files = {
  "package.json": "{}",
  "src/flows/checkout.flow.ts": "export default {};",
  "src/pages/login.ts": "export const login = 1;",
};

const manifestFor = (from: Record<string, string>, runnerId = "ci") =>
  toRunFilesManifest({ files: from, runnerId });

const delta = (
  held: ReturnType<typeof manifestFor> | undefined,
  runnerId = "ci",
) => buildRunFileDelta({ entryPointPath: flowPath, files, held, runnerId });

describe("hashRunFile", () => {
  it("hashes content, not the path it came from", () => {
    expect(hashRunFile("a")).toBe(hashRunFile("a"));
    expect(hashRunFile("a")).not.toBe(hashRunFile("b"));
    expect(hashRunFile("")).toHaveLength(64);
  });
});

describe("toRunFilesManifest", () => {
  it("records every file by path, sorted", () => {
    expect(manifestFor(files).files.map((entry) => entry.path)).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
      "src/pages/login.ts",
    ]);
  });
});

describe("buildRunFileDelta", () => {
  it("sends everything when the runner holds nothing", () => {
    expect(delta(undefined)).toEqual({ files, unchangedFiles: undefined });
  });

  it("sends everything when the baseline belongs to another runner", () => {
    expect(delta(manifestFor(files, "other"))).toEqual({
      files,
      unchangedFiles: undefined,
    });
  });

  it("keeps the entry point and package.json in full even when unchanged", () => {
    const built = delta(manifestFor(files));

    expect(Object.keys(built.files).sort()).toEqual([
      "package.json",
      "src/flows/checkout.flow.ts",
    ]);
    expect(built.unchangedFiles).toEqual({
      "src/pages/login.ts": hashRunFile(files["src/pages/login.ts"]),
    });
  });

  it("sends a file whose content moved since the baseline", () => {
    const stale = manifestFor({ ...files, "src/pages/login.ts": "old" });
    const built = delta(stale);

    expect(built.files["src/pages/login.ts"]).toBe(files["src/pages/login.ts"]);
    expect(built.unchangedFiles).toBeUndefined();
  });

  it("sends a file the baseline never held", () => {
    const partial = manifestFor({
      "package.json": "{}",
      "src/flows/checkout.flow.ts": "export default {};",
    });

    expect(delta(partial).unchangedFiles).toBeUndefined();
  });

  it("never names a path in both halves", () => {
    const built = delta(manifestFor(files));

    for (const path of Object.keys(built.unchangedFiles ?? {})) {
      expect(Object.hasOwn(built.files, path)).toBe(false);
    }
  });
});
