import { mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as tar from "tar";

import { extractTarGz } from "./extract.js";

let workDir = "";
let archivePath = "";
let destDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-extract-mtime-"));
  archivePath = join(workDir, "bundle.tar.gz");
  destDir = join(workDir, "out");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("extractTarGz mtime preservation", () => {
  it("preserves each entry's mtime on the extracted file", async () => {
    const stage = await mkdtemp(join(tmpdir(), "qawolf-stage-mtime-"));
    try {
      const fileA = join(stage, "a.flow.ts");
      const fileB = join(stage, "b.flow.ts");
      await writeFile(fileA, "// a", "utf8");
      await writeFile(fileB, "// b", "utf8");
      const mtimeA = new Date("2026-05-01T12:00:00.000Z");
      const mtimeB = new Date("2026-05-02T08:30:00.000Z");
      await utimes(fileA, mtimeA, mtimeA);
      await utimes(fileB, mtimeB, mtimeB);
      await tar.c({ gzip: true, file: archivePath, cwd: stage }, [
        "a.flow.ts",
        "b.flow.ts",
      ]);

      await extractTarGz(archivePath, destDir);

      // ext/APFS quantize to seconds or milliseconds; tolerate 1s drift.
      const tolerate = (actual: Date, expected: Date): boolean =>
        Math.abs(actual.getTime() - expected.getTime()) < 1000;
      expect(
        tolerate((await stat(join(destDir, "a.flow.ts"))).mtime, mtimeA),
      ).toBe(true);
      expect(
        tolerate((await stat(join(destDir, "b.flow.ts"))).mtime, mtimeB),
      ).toBe(true);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  });
});
