import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { loadFlowDefault } from "./loadFlowDefault.js";

describe("loadFlowDefault", () => {
  it("should return the default export when present", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-test-"));
    try {
      await writeFile(
        path.join(tmp, "flow.mjs"),
        "export default { name: 'test-flow' };\n",
      );
      const result = await loadFlowDefault<{ name: string }>(
        path.join(tmp, "flow.mjs"),
      );
      expect(result).toEqual({ name: "test-flow" });
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("should throw when default export is absent", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "load-flow-test-"));
    try {
      await writeFile(path.join(tmp, "flow.mjs"), "export const foo = 1;\n");
      let caught: unknown;
      try {
        await loadFlowDefault<unknown>(path.join(tmp, "flow.mjs"));
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
