import { describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import { replaceAssetsDir } from "./teamStorageAssetSnapshot.js";

describe("replaceAssetsDir", () => {
  it("surfaces rollback failures with the stranded old-assets path", async () => {
    const memoryFs = makeMemoryFs();
    await memoryFs.mkdir("/assets", { recursive: true });
    await memoryFs.writeFile("/assets/current.txt", "current");
    await memoryFs.mkdir("/assets.pull", { recursive: true });
    await memoryFs.writeFile("/assets.pull/next.txt", "next");

    const fs: Fs = {
      ...memoryFs,
      async rename(oldPath, newPath) {
        if (oldPath === "/assets.pull" && newPath === "/assets") {
          throw new Error("replace failed");
        }
        if (oldPath.startsWith("/assets.old-") && newPath === "/assets") {
          throw new Error("rollback failed");
        }
        await memoryFs.rename(oldPath, newPath);
      },
    };

    try {
      await replaceAssetsDir("/assets", "/assets.pull", fs);
      throw new Error("expected replaceAssetsDir to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        /\/assets\.old-.*rollback failed/,
      );
    }
  });
});
