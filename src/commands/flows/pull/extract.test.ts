import { createWriteStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as tar from "tar";

import { extractTarGz } from "./extract.js";

let workDir = "";
let archivePath = "";
let destDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-extract-"));
  archivePath = join(workDir, "bundle.tar.gz");
  destDir = join(workDir, "out");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

type StagedEntry =
  | { kind: "file"; name: string; data: Buffer | string }
  | { kind: "symlink"; name: string; target: string };

async function buildArchive(
  archivePathArg: string,
  entries: StagedEntry[],
): Promise<void> {
  const stage = await mkdtemp(join(tmpdir(), "qawolf-stage-"));
  try {
    for (const e of entries) {
      const target = join(stage, e.name);
      await mkdir(join(target, ".."), { recursive: true });
      if (e.kind === "file") {
        await writeFile(target, e.data);
      } else {
        await symlink(e.target, target);
      }
    }
    await tar.c(
      { gzip: true, file: archivePathArg, cwd: stage },
      entries.map((e) => e.name),
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

// Minimal raw-tar+gzip writer for fixtures we can't build with tar.c
// (paths with `..`, absolute names — tar.c rejects/strips them).
async function writeRawTarGzWithName(
  archivePathArg: string,
  name: string,
): Promise<void> {
  // 512-byte tar header per POSIX ustar format.
  const header = Buffer.alloc(512);
  Buffer.from(name, "utf8").copy(header, 0); // name (100 bytes)
  Buffer.from("0000644\0", "utf8").copy(header, 100); // mode (8 bytes)
  Buffer.from("0000000\0", "utf8").copy(header, 108); // uid
  Buffer.from("0000000\0", "utf8").copy(header, 116); // gid
  Buffer.from("00000000000\0", "utf8").copy(header, 124); // size (12 bytes octal, 0)
  Buffer.from("00000000000\0", "utf8").copy(header, 136); // mtime
  // checksum field 148-155: filled with spaces during checksum computation
  header.fill(0x20, 148, 156);
  Buffer.from("0", "utf8").copy(header, 156); // typeflag = '0' (regular file)
  // ustar magic ("ustar\0") + version ("00")
  Buffer.from("ustar\x0000", "binary").copy(header, 257);

  // Compute checksum: sum of all bytes treating chksum field as spaces.
  let cksum = 0;
  for (const b of header) cksum += b;
  Buffer.from(`${cksum.toString(8).padStart(6, "0")}\0 `, "utf8").copy(
    header,
    148,
  );

  // End-of-archive: two empty 512-byte blocks.
  const eof = Buffer.alloc(1024);
  const tarBytes = Buffer.concat([header, eof]);

  await new Promise<void>((res, rej) => {
    const out = createWriteStream(archivePathArg);
    out.on("close", () => res());
    out.on("error", rej);
    const gz = createGzip();
    gz.on("error", rej);
    gz.pipe(out);
    gz.end(tarBytes);
  });
}

describe("extractTarGz happy path", () => {
  it("extracts a valid tar.gz with nested files", async () => {
    await buildArchive(archivePath, [
      { kind: "file", name: "a.flow.ts", data: "export const x = 1\n" },
      { kind: "file", name: "nested/b.flow.ts", data: "// flow b\n" },
      { kind: "file", name: "package.json", data: '{"name":"bundle"}\n' },
    ]);

    await extractTarGz(archivePath, destDir);

    expect(await readFile(join(destDir, "a.flow.ts"), "utf8")).toBe(
      "export const x = 1\n",
    );
    expect(await readFile(join(destDir, "nested/b.flow.ts"), "utf8")).toBe(
      "// flow b\n",
    );
    expect(await readFile(join(destDir, "package.json"), "utf8")).toBe(
      '{"name":"bundle"}\n',
    );
  });
});

async function expectRejects(
  promise: Promise<unknown>,
  pattern?: RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  if (pattern) {
    expect((caught as Error).message).toMatch(pattern);
  }
}

describe("extractTarGz safety guards", () => {
  it("rejects entries with parent-traversal segments and writes nothing", async () => {
    await writeRawTarGzWithName(archivePath, "../escape.txt");
    await expectRejects(extractTarGz(archivePath, destDir));
    expect(await exists(join(workDir, "escape.txt"))).toBe(false);
  });

  it("rejects entries with absolute paths", async () => {
    await writeRawTarGzWithName(archivePath, "/etc/passwd");
    await expectRejects(extractTarGz(archivePath, destDir));
  });

  it("rejects an entry exceeding the per-entry size cap", async () => {
    const big = Buffer.alloc(100, 0x61);
    await buildArchive(archivePath, [
      { kind: "file", name: "big.bin", data: big },
    ]);

    await expectRejects(
      extractTarGz(archivePath, destDir, {
        maxEntryBytes: 50,
        maxTotalBytes: 1000,
      }),
      /entry|too large|size/i,
    );

    expect(await exists(join(destDir, "big.bin"))).toBe(false);
  });

  it("rejects when total uncompressed size exceeds the cap", async () => {
    await buildArchive(archivePath, [
      { kind: "file", name: "a.bin", data: Buffer.alloc(40, 0x61) },
      { kind: "file", name: "b.bin", data: Buffer.alloc(40, 0x61) },
    ]);

    await expectRejects(
      extractTarGz(archivePath, destDir, {
        maxEntryBytes: 50,
        maxTotalBytes: 60,
      }),
      /total|too large|size|cap/i,
    );
  });

  it("rejects symlink entries", async () => {
    await buildArchive(archivePath, [
      { kind: "file", name: "a.txt", data: "ok" },
      { kind: "symlink", name: "link", target: "/etc/passwd" },
    ]);

    await expectRejects(extractTarGz(archivePath, destDir), /symlink|link/i);
  });

  it("creates intermediate directories for nested file entries", async () => {
    await buildArchive(archivePath, [
      { kind: "file", name: "a/b/c/d.flow.ts", data: "deep" },
    ]);

    await extractTarGz(archivePath, destDir);

    expect(await readFile(join(destDir, "a/b/c/d.flow.ts"), "utf8")).toBe(
      "deep",
    );
  });

  it("does not write any file when the first entry violates a guard", async () => {
    await writeRawTarGzWithName(archivePath, "../escape.txt");
    await expectRejects(extractTarGz(archivePath, destDir));

    expect(await exists(join(workDir, "escape.txt"))).toBe(false);
    if (await exists(destDir)) {
      const entries = await readdir(destDir);
      expect(entries).toEqual([]);
    }
  });
});
