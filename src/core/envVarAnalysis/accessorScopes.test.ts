import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("accessor scopes", () => {
  it("resolves reverse-order forwarding chains without a depth limit", async () => {
    const helpers =
      Array.from(
        { length: 20 },
        (_, index) =>
          `export function read${index}(name: string) { return read${index + 1}(name); }`,
      ).join("\n") +
      `\nexport function read20(name: string) { return process.env[name]; }`;
    const result = await analyse({
      "src/lib/env.ts": helpers,
      [flow]: `import { read0 } from "../lib/env.js"; export default () => read0("TOKEN");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["TOKEN"],
        mayBeIncomplete: false,
      });
      expect(result.accessorCount).toBe(21);
    } finally {
      await result.cleanup();
    }
  });

  it("resolves a literal passed to an accessor in the flow file", async () => {
    const result = await analyse({
      [flow]: `function env(name: string) { return process.env[name]; }
        export default () => env("TOKEN");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["TOKEN"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });

  it("does not mistake a shadowed parameter for an accessor key", async () => {
    const result = await analyse({
      [flow]: `function env(key: string) {
        { const key = "ACTUAL"; return process.env[key]; }
      }
      export default () => env("FALSE_POSITIVE");`,
    });
    try {
      expect(result.byFlow.get(flow)?.names).not.toContain("FALSE_POSITIVE");
      expect(result.byFlow.get(flow)?.mayBeIncomplete).toBe(true);
      expect(result.accessorCount).toBe(0);
    } finally {
      await result.cleanup();
    }
  });

  it("does not classify a helper by reads inside a dormant nested function", async () => {
    const result = await analyse({
      [flow]: `function helper(name: string) {
        function later(name: string) { return process.env[name]; }
        return process.env.USED;
      }
      export default () => helper("NEVER");`,
    });
    try {
      expect(result.byFlow.get(flow)).toEqual({
        names: ["USED"],
        mayBeIncomplete: false,
      });
    } finally {
      await result.cleanup();
    }
  });
});
