import { afterEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { importFromPath } from "./importFromPath.js";
import { makeTmpDirTracker } from "./tmpDir.testUtils.js";

const tmp = makeTmpDirTracker("qawolf-import-from-path-");

afterEach(() => tmp.cleanup());

describe("importFromPath", () => {
  it("imports a module addressed by absolute filesystem path", async () => {
    const dir = await tmp.makeTmpDir();
    const modPath = join(dir, "fixture.mjs");
    await writeFile(modPath, 'export const loaded = "esm-ok";\n');

    const mod = (await importFromPath(modPath)) as { loaded?: string };

    expect(mod.loaded).toBe("esm-ok");
  });
});
