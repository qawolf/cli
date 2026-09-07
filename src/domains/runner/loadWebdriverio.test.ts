import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";

import { loadWebdriverio } from "./loadWebdriverio.js";

type FakeRemote = (opts: Record<string, unknown>) => Promise<unknown>;

const tracker = makeTmpDirTracker("qawolf-load-webdriverio-");

afterEach(() => tracker.cleanup());

async function writeFakeWebdriverio(envDir: string): Promise<void> {
  const pkgDir = join(envDir, "node_modules", "webdriverio");
  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    join(pkgDir, "package.json"),
    JSON.stringify({
      name: "webdriverio",
      version: "0.0.0-test",
      type: "module",
      exports: { ".": { import: "./index.js" } },
    }),
  );
  await writeFile(
    join(pkgDir, "index.js"),
    "export const remote = async (opts) => ({ opts });\n",
  );
}

describe("loadWebdriverio", () => {
  it("imports webdriverio from the env dir's node_modules, not the CLI's", async () => {
    const envDir = await tracker.makeTmpDir();
    await writeFakeWebdriverio(envDir);

    const { remote } = await loadWebdriverio(envDir);
    const session = (await (remote as unknown as FakeRemote)({
      port: 4723,
    })) as { opts: { port: number } };

    expect(session.opts.port).toBe(4723);
  });

  it("names the package and env dir when it is not installed there", async () => {
    const envDir = await tracker.makeTmpDir();

    let caught: unknown;
    try {
      await loadWebdriverio(envDir);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("webdriverio");
    expect((caught as Error).message).toContain(envDir);
  });
});
