import { readlink } from "node:fs/promises";
import { resolve } from "node:path";

import { expect } from "bun:test";

// createDirSymlink makes a junction on win32, and readlink reports a junction
// target with a "\\?\" prefix and a trailing separator. Canonicalize both sides
// so the assertion still pins the exact target directory.
function normalizeLinkTarget(target: string) {
  return resolve(target.replace(/^\\\\\?\\/, ""));
}

export async function expectLinkTarget(linkPath: string, expected: string) {
  expect(normalizeLinkTarget(await readlink(linkPath))).toBe(
    normalizeLinkTarget(expected),
  );
}
