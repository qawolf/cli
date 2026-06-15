import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { _resetInitCache, initFlowRuntime } from "./initFlowRuntime.js";

afterEach(() => {
  _resetInitCache();
});

const thisDir = import.meta.dirname;

/** Reads back the expect timeout the runner configured on @qawolf/flows. */
async function readConfiguredExpectTimeout(): Promise<number> {
  const idxUrl = import.meta.resolve("@qawolf/flows");
  const attrsUrl = new URL("./web/expect/attributes.js", idxUrl).href;
  const { getWebExpectAttributes } = (await import(attrsUrl)) as {
    getWebExpectAttributes: () => { defaultExpectTimeoutMs: number };
  };
  return getWebExpectAttributes().defaultExpectTimeoutMs;
}

describe("initFlowRuntime", () => {
  it("resolves using the CLI's own @qawolf/flows", async () => {
    await initFlowRuntime(path.join(thisDir, "fake.flow.ts"), {
      timeout: 30_000,
    });
  });

  it("configures the @qawolf/flows expect timeout from the passed timeout", async () => {
    await initFlowRuntime(path.join(thisDir, "fake.flow.ts"), {
      timeout: 5_000,
    });
    expect(await readConfiguredExpectTimeout()).toBe(5_000);
  });

  it("returns the same promise for repeated calls from the same directory", () => {
    const p1 = initFlowRuntime(path.join(thisDir, "a.flow.ts"), {
      timeout: 30_000,
    });
    const p2 = initFlowRuntime(path.join(thisDir, "b.flow.ts"), {
      timeout: 30_000,
    });
    expect(p1).toBe(p2);
  });

  it("returns a different promise for a different starting directory", () => {
    const p1 = initFlowRuntime(path.join(thisDir, "a.flow.ts"), {
      timeout: 30_000,
    });
    const p2 = initFlowRuntime(path.join(thisDir, "sub", "b.flow.ts"), {
      timeout: 30_000,
    });
    expect(p1).not.toBe(p2);
    // settle both so they don't leak into subsequent tests
    return Promise.allSettled([p1, p2]);
  });

  it("throws when @qawolf/flows is not found in any parent directory", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-init-test-"));
    try {
      let caught: unknown;
      try {
        await initFlowRuntime(path.join(tmp, "my.flow.ts"), {
          timeout: 30_000,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain(
        "not found in node_modules above",
      );
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("throws when package.json exports map is missing the ./_runner import condition", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-init-test-"));
    try {
      const pkgDir = path.join(tmp, "node_modules", "@qawolf", "flows");
      await mkdir(pkgDir, { recursive: true });
      await writeFile(
        path.join(pkgDir, "package.json"),
        JSON.stringify({
          exports: { "./_runner": { require: "./runner.cjs" } },
        }),
      );
      let caught: unknown;
      try {
        await initFlowRuntime(path.join(tmp, "my.flow.ts"), {
          timeout: 30_000,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain(
        'does not export "./_runner"',
      );
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("re-throws non-ENOENT errors from readFile", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-init-test-"));
    try {
      const pkgDir = path.join(tmp, "node_modules", "@qawolf", "flows");
      await mkdir(pkgDir, { recursive: true });
      // A directory where the file should be causes readFile to throw EISDIR.
      await mkdir(path.join(pkgDir, "package.json"));
      let caught: unknown;
      try {
        await initFlowRuntime(path.join(tmp, "my.flow.ts"), {
          timeout: 30_000,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as NodeJS.ErrnoException).code).toBe("EISDIR");
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
