import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createDirSymlink } from "./symlinkDir.js";
import { expectLinkTarget } from "./symlinkDir.testUtils.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-symlink-utils-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("expectLinkTarget", () => {
  it("passes for a link created by createDirSymlink", async () => {
    const target = join(workDir, "target");
    await mkdir(target);
    const link = join(workDir, "link");
    await createDirSymlink(target, link);

    await expectLinkTarget(link, target);
  });

  it("passes when the reported target carries a junction prefix and trailing separator", async () => {
    const target = join(workDir, "target");
    await mkdir(target);
    const link = join(workDir, "link");
    // Stand in for the win32 junction spelling that readlink reports.
    await createDirSymlink(`\\\\?\\${target}/`, link);

    await expectLinkTarget(link, target);
  });

  it("fails when the link points somewhere else", async () => {
    const target = join(workDir, "target");
    const other = join(workDir, "other");
    await mkdir(target);
    await mkdir(other);
    const link = join(workDir, "link");
    await createDirSymlink(other, link);

    let caughtError: unknown;
    try {
      await expectLinkTarget(link, target);
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
  });
});
