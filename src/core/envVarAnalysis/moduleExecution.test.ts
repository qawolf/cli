import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("module initialization", () => {
  it.each([
    [
      "an imported constant",
      `import { token } from "../lib/config.js";
      export default () => token;`,
    ],
    [
      "a side-effect import",
      `import "../lib/config.js";
      export default () => 1;`,
    ],
    [
      "an imported helper",
      `import { read } from "../lib/config.js";
      export default () => read();`,
    ],
    [
      "a literal dynamic import",
      `export default async () => (await import("../lib/config.js")).token;`,
    ],
  ])("includes initialization from %s", async (_name, contents) => {
    const result = await analyse({
      "src/lib/config.ts": `export const token = process.env.TOKEN;
        export function read() { return token; }
        export function dormant() { return process.env.NEVER; }`,
      [flow]: contents,
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

  it.each([
    `import type { Config } from "../lib/config.js";`,
    `import { type Config } from "../lib/config.js";`,
    `export type { Config } from "../lib/config.js";`,
    `import { Config } from "../lib/config.js"; const value: Config = "value";`,
  ])("excludes erased type imports: %s", async (statement) => {
    const result = await analyse({
      "src/lib/config.ts": `void process.env.NEVER; export type Config = string;`,
      [flow]: `${statement} export default () => process.env.USED;`,
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

  it("includes initialization through a cycle of side-effect imports", async () => {
    const result = await analyse({
      "src/lib/a.ts": `import "./b.js"; void process.env.A;`,
      "src/lib/b.ts": `import "./a.js"; void process.env.B;`,
      [flow]: `import "../lib/a.js"; export default () => 1;`,
    });
    try {
      expect(result.byFlow.get(flow)?.names).toEqual(["A", "B"]);
    } finally {
      await result.cleanup();
    }
  });

  it("flags a nonliteral dynamic import", async () => {
    const result = await analyse({
      [flow]: `export default async (modulePath: string) => import(modulePath);`,
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
});
