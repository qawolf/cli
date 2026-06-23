import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { pathExists } from "~/shell/fs.js";
import { loadFlowDefault } from "./loadFlowDefault.js";

// ── Node path (direct import) ───────────────────────────────────────────────

describe("loadFlowDefault (Node path)", () => {
  it("returns the default export when present", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-test-"));
    try {
      await writeFile(
        path.join(tmp, "flow.mjs"),
        "export default { name: 'test-flow' };\n",
      );
      const result = await loadFlowDefault<{ name: string }>({
        flowPath: path.join(tmp, "flow.mjs"),
        bundleFlow: undefined,
      });
      expect(result).toEqual({ name: "test-flow" });
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("throws when default export is absent", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-test-"));
    try {
      await writeFile(path.join(tmp, "flow.mjs"), "export const foo = 1;\n");
      let caught: unknown;
      try {
        await loadFlowDefault<unknown>({
          flowPath: path.join(tmp, "flow.mjs"),
          bundleFlow: undefined,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toMatch(/No default export found in "/);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});

// ── Bundle path (pre-bundled, compiled-binary) ──────────────────────────────

describe("loadFlowDefault (bundle path)", () => {
  function tempBundlePath(flowPath: string): string {
    return path.join(
      path.dirname(flowPath),
      `.${path.basename(flowPath)}.qawolf-bundle.mjs`,
    );
  }

  it("returns the default export from the bundled source", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-bundle-"));
    try {
      const flowPath = path.join(tmp, "flow.ts");
      const bundleFlow = async () => `export default { name: "x" };\n`;
      const result = await loadFlowDefault<{ name: string }>({
        flowPath,
        bundleFlow,
      });
      expect(result).toEqual({ name: "x" });
      expect(await pathExists(tempBundlePath(flowPath))).toBe(false);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("removes the temp file when the default export is absent", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-bundle-"));
    try {
      const flowPath = path.join(tmp, "flow.ts");
      const bundleFlow = async () => `export const foo = 1;\n`;
      let caught: unknown;
      try {
        await loadFlowDefault<unknown>({ flowPath, bundleFlow });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toMatch(/No default export found in "/);
      expect(await pathExists(tempBundlePath(flowPath))).toBe(false);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
