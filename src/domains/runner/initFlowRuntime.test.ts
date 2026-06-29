import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  _resetInitCache,
  initFlowRuntime,
  runnerPathInDir,
} from "./initFlowRuntime.js";

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

  it("uses depsRoot to resolve _runner when provided, skipping walk-up", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-init-depsroot-"));
    try {
      // Build a minimal @qawolf/flows in depsRoot with a _runner export
      const pkgDir = path.join(tmp, "node_modules", "@qawolf", "flows");
      await mkdir(pkgDir, { recursive: true });
      const runnerJs = path.join(pkgDir, "runner.js");
      await writeFile(
        runnerJs,
        `export async function configureFlowRuntime() {}\n`,
      );
      await writeFile(
        path.join(pkgDir, "package.json"),
        JSON.stringify({
          exports: { "./_runner": { import: "./runner.js" } },
        }),
      );

      // Flow file is in an isolated tmp directory — no @qawolf/flows ancestor
      const flowTmp = await mkdtemp(
        path.join(tmpdir(), "qawolf-init-isolated-"),
      );
      try {
        await initFlowRuntime(path.join(flowTmp, "my.flow.ts"), {
          timeout: 30_000,
          depsRoot: tmp,
        });
        // If we reach here, depsRoot resolution succeeded
      } finally {
        await rm(flowTmp, { recursive: true });
      }
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("throws when depsRoot is set but @qawolf/flows is not found there", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-init-test-"));
    try {
      let caught: unknown;
      try {
        await initFlowRuntime(path.join(thisDir, "fake.flow.ts"), {
          timeout: 30_000,
          depsRoot: tmp,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain(
        "not found in node_modules of depsRoot",
      );
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});

describe("runnerPathInDir", () => {
  it("returns undefined when @qawolf/flows is not present in the directory", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-runner-path-"));
    try {
      const { makeDefaultFs } = await import("~/shell/fs.js");
      const result = await runnerPathInDir(tmp, makeDefaultFs());
      expect(result).toBeUndefined();
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("returns the resolved runner path when package.json has a valid _runner export", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "qawolf-runner-path-"));
    try {
      const pkgDir = path.join(tmp, "node_modules", "@qawolf", "flows");
      await mkdir(pkgDir, { recursive: true });
      await writeFile(
        path.join(pkgDir, "package.json"),
        JSON.stringify({
          exports: { "./_runner": { import: "./runner.js" } },
        }),
      );
      const { makeDefaultFs } = await import("~/shell/fs.js");
      const result = await runnerPathInDir(tmp, makeDefaultFs());
      expect(result).toBe(path.join(pkgDir, "runner.js"));
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
