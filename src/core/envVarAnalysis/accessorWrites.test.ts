import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("accessor writes", () => {
  it.each([
    'key = "OTHER";',
    'key += "_OTHER";',
    "++key;",
    "key++;",
    '[key] = ["OTHER"];',
    '({ key } = { key: "OTHER" });',
    'for (key of ["OTHER"]) {}',
    "for (key in { OTHER: true }) {}",
    'function change() { key = "OTHER"; } change();',
  ])("does not infer a key after a write: %s", async (write) => {
    const result = await analyse({
      [flow]: `function env(key: string) { ${write} return process.env[key]; }
        export default () => env("INPUT");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: [],
        mayBeIncomplete: true,
      });
      expect(result.accessorCount).toBe(0);
    } finally {
      await result.cleanup();
    }
  });

  it("does not forward a reassigned key", async () => {
    const result = await analyse({
      [flow]: `function env(key: string) { return process.env[key]; }
        function read(key: string) { key = "OTHER"; return env(key); }
        export default () => read("INPUT");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: [],
        mayBeIncomplete: true,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("retains untouched key slots beside a reassigned slot", async () => {
    const result = await analyse({
      [flow]: `function env(first: string, second: string) {
        first = "OTHER";
        return process.env[first] + process.env[second];
      }
      export default () => env("INPUT", "SECOND");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["SECOND"],
        mayBeIncomplete: true,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("does not invalidate a parameter for a shadowed write", async () => {
    const result = await analyse({
      [flow]: `function env(key: string) {
        { let key = "LOCAL"; key = "OTHER"; }
        return process.env[key];
      }
      export default () => env("INPUT");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["INPUT"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });
});
